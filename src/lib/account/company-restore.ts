import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { privateStorage } from "@/lib/storage";
import {
  verifyBackupPrivateFiles,
  backupPrivateFileKeys,
  type BackupPrivateFile,
} from "./backup-private-files";
import {
  assertRestoreSnapshot,
  readRestoreSnapshot,
  restoreDelegate,
  restoreRows,
  RESTORE_MODELS,
  snapshotDigest,
  type RestoreSnapshot,
} from "./restore-snapshot";
import { requireCompanyRestoreOwner } from "./restore-owner";
import {
  createAccountBackupForActor,
  verifyAccountDataForActor,
} from "./utilities";
type Actor = { id: string; companyId: string; accountRole?: string | null };
type Bundle = {
  manifest: {
    format: string;
    formatVersion: number;
    generatedAt: string;
    company: { id: string; name: string };
  };
  data: Record<string, unknown> & { restoreSnapshot: RestoreSnapshot };
  privateFiles?: BackupPrivateFile[];
};
const LIMIT = 128 * 1024 * 1024;
function parseBundle(bytes: Uint8Array, companyId: string): Bundle {
  if (!bytes.length || bytes.length > LIMIT)
    throw new Error("RESTORE_FILE_TOO_LARGE");
  let bundle: Bundle;
  try {
    bundle = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("RESTORE_INVALID_FILE");
  }
  if (
    !bundle ||
    typeof bundle !== "object" ||
    bundle.manifest?.format !== "SalesPunch360 Account Backup" ||
    bundle.manifest.formatVersion !== 4
  )
    throw new Error("RESTORE_LEGACY_BACKUP_UNSUPPORTED");
  if (
    bundle.manifest.company?.id !== companyId ||
    bundle.data?.id !== companyId
  )
    throw new Error("RESTORE_SCOPE_INVALID");
  if (
    !Number.isFinite(Date.parse(bundle.manifest.generatedAt)) ||
    Date.parse(bundle.manifest.generatedAt) > Date.now()
  )
    throw new Error("RESTORE_INVALID_FILE");
  assertRestoreSnapshot(bundle.data.restoreSnapshot, companyId);
  // Parse all typed values before any transaction is allowed to delete records.
  for (const model of RESTORE_MODELS)
    restoreRows(model.name, bundle.data.restoreSnapshot.models[model.name]);
  return bundle;
}
const filesView = (bundle: Bundle) => ({
  ...bundle.data,
  ...bundle.data.restoreSnapshot.models,
});
async function assertFilesAvailable(
  bundle: Bundle,
  companyId: string,
  allowRecoverMissing = false,
) {
  const snapshot = filesView(bundle),
    storage = privateStorage();
  if (bundle.privateFiles)
    verifyBackupPrivateFiles(companyId, snapshot, bundle.privateFiles);
  for (const key of backupPrivateFileKeys(companyId, snapshot)) {
    const embedded = bundle.privateFiles?.find(
      (file) => file.objectKey === key,
    );
    let bytes: Buffer;
    try {
      bytes = await storage.get(key);
    } catch {
      if (!allowRecoverMissing || !embedded)
        throw new Error("RESTORE_PRIVATE_FILE_MISSING");
      // Recreate only absent immutable object keys; never overwrite a different live file.
      bytes = Buffer.from(embedded.data, "base64");
      await storage.put(key, bytes);
    }
    if (
      embedded &&
      createHash("sha256").update(bytes).digest("hex") !== embedded.sha256
    )
      throw new Error("RESTORE_PRIVATE_FILE_CONFLICT");
  }
}
/** Upload review is read-only for business records; the original bytes are staged privately. */
export async function prepareCompanyRestore(actor: Actor, bytes: Uint8Array) {
  await requireCompanyRestoreOwner(actor);
  const bundle = parseBundle(bytes, actor.companyId),
    checksum = createHash("sha256").update(bytes).digest("hex");
  const source = await db.accountBackupRecord.findFirst({
    where: { companyId: actor.companyId, checksum },
    select: { id: true },
  });
  if (!source) throw new Error("RESTORE_UNRECOGNIZED_BACKUP");
  if (bundle.privateFiles)
    verifyBackupPrivateFiles(
      actor.companyId,
      filesView(bundle),
      bundle.privateFiles,
    );
  // Record-only bundles need their original immutable private-storage objects.
  if (!bundle.privateFiles) await assertFilesAvailable(bundle, actor.companyId);
  const [company, current] = await Promise.all([
    db.company.findUniqueOrThrow({
      where: { id: actor.companyId },
      select: { name: true },
    }),
    db.$transaction((tx) => readRestoreSnapshot(tx, actor.companyId), {
      isolationLevel: "RepeatableRead",
      timeout: 60000,
    }),
  ]);
  const id = randomUUID(),
    objectKey = `companies/${actor.companyId}/account-backups/restore-review-${id}.json`;
  const counts = RESTORE_MODELS.map((model) => ({
    model: model.name,
    current: current.models[model.name].length,
    restored: bundle.data.restoreSnapshot.models[model.name].length,
  }));
  await privateStorage().put(objectKey, Buffer.from(bytes));
  try {
    await db.accountBackupRecord.create({
      data: {
        id,
        companyId: actor.companyId,
        generatedById: actor.id,
        checksum,
        manifest: {
          kind: "RESTORE_REVIEW",
          state: "PENDING",
          sourceBackupId: source.id,
          objectKey,
          companyName: company.name,
          backupDate: bundle.manifest.generatedAt,
          currentDigest: snapshotDigest(current),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          counts,
        },
      },
    });
  } catch (error) {
    await privateStorage()
      .delete(objectKey)
      .catch(() => undefined);
    throw error;
  }
  return {
    id,
    companyName: company.name,
    backupDate: bundle.manifest.generatedAt,
    counts,
  };
}
/** A separate authenticated request confirms the reviewed company replacement. */
export async function executeCompanyRestore(actor: Actor, raw: unknown) {
  await requireCompanyRestoreOwner(actor);
  const input = z
    .object({
      reviewId: z.string().uuid(),
      companyName: z.string(),
      confirmed: z.literal(true),
    })
    .strict()
    .parse(raw);
  const review = await db.accountBackupRecord.findFirst({
    where: {
      id: input.reviewId,
      companyId: actor.companyId,
      generatedById: actor.id,
    },
  });
  const plan = review?.manifest as Record<string, unknown> | null;
  if (!review || plan?.kind !== "RESTORE_REVIEW")
    throw new Error("RESTORE_REVIEW_NOT_FOUND");
  if (plan.state === "COMPLETED") return { restored: true, idempotent: true };
  if (
    plan.state !== "PENDING" ||
    typeof plan.expiresAt !== "string" ||
    Date.parse(plan.expiresAt) < Date.now()
  )
    throw new Error("RESTORE_REVIEW_EXPIRED");
  if (input.companyName !== plan.companyName)
    throw new Error("RESTORE_COMPANY_CONFIRMATION_REQUIRED");
  const key = String(plan.objectKey);
  if (
    key !==
    `companies/${actor.companyId}/account-backups/restore-review-${review.id}.json`
  )
    throw new Error("RESTORE_SCOPE_INVALID");
  const bytes = await privateStorage().get(key);
  if (createHash("sha256").update(bytes).digest("hex") !== review.checksum)
    throw new Error("RESTORE_CHECKSUM_MISMATCH");
  const bundle = parseBundle(bytes, actor.companyId);
  await assertFilesAvailable(bundle, actor.companyId, true);
  // Save a durable file-inclusive recovery copy before entering destructive work.
  const safety = await createAccountBackupForActor(
    { ...actor, accountRole: actor.accountRole ?? null },
    true,
    true,
    undefined,
    undefined,
    true,
  );
  const safetyBundle = parseBundle(safety.bytes, actor.companyId);
  const expectedCurrent = snapshotDigest(safetyBundle.data.restoreSnapshot);
  if (expectedCurrent !== plan.currentDigest)
    throw new Error("RESTORE_COMPANY_CHANGED_REVIEW_AGAIN");
  return db
    .$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM companies WHERE id=${actor.companyId}::uuid FOR UPDATE`;
        // Full-company recovery briefly excludes concurrent writes; ordinary reads stay available.
        await tx.$executeRaw(
          Prisma.sql`LOCK TABLE ${Prisma.join(RESTORE_MODELS.map((model) => Prisma.raw(`"${model.dbName ?? model.name}"`)).sort((a, b) => a.sql.localeCompare(b.sql)))} IN SHARE ROW EXCLUSIVE MODE`,
        );
        const currentReview = await tx.accountBackupRecord.findFirst({
          where: { id: review.id, companyId: actor.companyId },
        });
        const currentPlan = currentReview?.manifest as Record<
          string,
          unknown
        > | null;
        if (currentPlan?.state === "COMPLETED")
          return { restored: true, idempotent: true };
        if (
          currentPlan?.state !== "PENDING" ||
          !Number.isFinite(Date.parse(String(currentPlan?.expiresAt))) ||
          Date.parse(String(currentPlan?.expiresAt)) <= Date.now()
        )
          throw new Error("RESTORE_REVIEW_EXPIRED");
        const owner = await tx.user.findFirst({
          where: {
            id: actor.id,
            companyId: actor.companyId,
            isActive: true,
            accountAccessActive: true,
            accountRole: "ACCOUNT_ADMIN",
            branchAccessScope: "ALL_BRANCHES",
            OR: [{ role: "COMPANY_ADMIN" }, { salesRole: "PRIMARY_ADMIN" }],
          },
          select: { id: true },
        });
        if (!owner) throw new Error("UNAUTHORIZED");
        await assertFilesAvailable(bundle, actor.companyId, true);
        const current = await readRestoreSnapshot(tx, actor.companyId);
        if (snapshotDigest(current) !== expectedCurrent)
          throw new Error("RESTORE_COMPANY_CHANGED_REVIEW_AGAIN");
        const userIds = (
          await tx.user.findMany({
            where: { companyId: actor.companyId },
            select: { id: true },
          })
        ).map((user) => user.id);
        const accessBefore = await tx.userBranchAccess.findMany({
          where: { userId: { in: userIds } },
          orderBy: [{ userId: "asc" }, { branchId: "asc" }],
        });
        await tx.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
        await tx.$queryRaw`SELECT set_config('app.company_restore_company_id',${actor.companyId},true)`;
        // Public quotation bearer links are credentials, excluded from snapshots.
        // Revoke them rather than retaining links to replaced/reused revisions.
        await tx.quotationShare.deleteMany({
          where: { companyId: actor.companyId },
        });
        for (const model of [...RESTORE_MODELS].reverse())
          await restoreDelegate(tx, model.name).deleteMany({
            where: { companyId: actor.companyId },
          });
        for (const model of RESTORE_MODELS) {
          const rows = restoreRows(
            model.name,
            bundle.data.restoreSnapshot.models[model.name],
          );
          for (let index = 0; index < rows.length; index += 500)
            await restoreDelegate(tx, model.name).createMany({
              data: rows.slice(index, index + 500),
            });
        }
        const companyFields = [
          "name",
          "primaryPhone",
          "contactEmail",
          "gstin",
          "addressLine1",
          "addressLine2",
          "locality",
          "city",
          "state",
          "postalCode",
          "country",
          "logoObjectKey",
        ];
        await tx.company.update({
          where: { id: actor.companyId },
          data: Object.fromEntries(
            companyFields
              .filter((field) => field in bundle.data.restoreSnapshot.company)
              .map((field) => [
                field,
                bundle.data.restoreSnapshot.company[field],
              ]),
          ),
        });
        // Restored live files must no longer be eligible for deferred deletion.
        const restoredFileKeys = backupPrivateFileKeys(
          actor.companyId,
          filesView(bundle),
        );
        if (restoredFileKeys.length)
          await tx.pendingStorageDeletion.deleteMany({
            where: {
              OR: [{ companyId: actor.companyId }, { companyId: null }],
              objectKey: { in: restoredFileKeys },
            },
          });
        await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
        const accessAfter = await tx.userBranchAccess.findMany({
          where: { userId: { in: userIds } },
          orderBy: [{ userId: "asc" }, { branchId: "asc" }],
        });
        if (JSON.stringify(accessBefore) !== JSON.stringify(accessAfter))
          throw new Error("RESTORE_IDENTITY_REFERENCE_CONFLICT");
        const restored = await readRestoreSnapshot(tx, actor.companyId);
        for (const model of RESTORE_MODELS)
          if (
            restored.models[model.name].length !==
            bundle.data.restoreSnapshot.models[model.name].length
          )
            throw new Error("RESTORE_ROW_COUNT_MISMATCH");
        const failures = (await verifyAccountDataForActor(actor, tx)).filter(
          (check) => check.status === "ERROR",
        );
        if (failures.length) throw new Error("RESTORE_VERIFICATION_FAILED");
        await tx.$queryRaw`SELECT set_config('app.company_restore_company_id','',true)`;
        await tx.accountBackupRecord.update({
          where: { id: review.id, companyId: actor.companyId },
          data: {
            manifest: {
              ...currentPlan,
              state: "COMPLETED",
              completedAt: new Date().toISOString(),
              safetyBackupId: safety.id,
            } as Prisma.InputJsonValue,
          },
        });
        await tx.accountingAuditEvent.create({
          data: {
            companyId: actor.companyId,
            actorUserId: actor.id,
            eventType: "SETTINGS_CHANGED",
            entityType: "COMPANY_RESTORE",
            entityId: review.id,
            metadata: {
              sourceBackupId: plan.sourceBackupId as string,
              backupDate: bundle.manifest.generatedAt,
              safetyBackupId: safety.id,
            },
          },
        });
        return { restored: true, idempotent: false };
      },
      { timeout: 120000, isolationLevel: "Serializable" },
    )
    .catch(async (error) => {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2034"
      ) {
        const completed = await db.accountBackupRecord.findFirst({
          where: {
            id: review.id,
            companyId: actor.companyId,
            generatedById: actor.id,
          },
          select: { manifest: true },
        });
        if (
          (completed?.manifest as Record<string, unknown> | null)?.state ===
          "COMPLETED"
        )
          return { restored: true, idempotent: true };
      }
      throw error;
    });
}
