import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { updateSettingsSectionForActor } from "./settings-persistence";
import {
  assertGoogleBackupConnected,
  googleBackupStatus,
  uploadGoogleBackup,
} from "./google-drive-backup";
import { createAccountBackupForActor } from "./utilities";
export const backupSettingsSchema = z
  .object({
    autoBackup: z.boolean(),
    intervalDays: z.number().int().min(1).max(365),
    manualReminderDays: z.number().int().min(1).max(365),
  })
  .strict();
export async function saveBackupSettings(
  actor: Parameters<typeof updateSettingsSectionForActor>[0],
  raw: unknown,
) {
  if (!actor.companyId || actor.accountRole !== "ACCOUNT_ADMIN")
    throw new AuthorizationError();
  const settings = backupSettingsSchema.parse(raw);
  if (settings.autoBackup) await assertGoogleBackupConnected(actor.companyId);
  return updateSettingsSectionForActor(actor, "backupSettings", settings);
}
/** Hold a company lock across generation and verified Drive delivery; no server archive fallback. */
export async function runGoogleDriveBackup(
  actor: { id: string; companyId: string; accountRole: string | null },
  now = new Date(),
  force = false,
) {
  if (actor.accountRole !== "ACCOUNT_ADMIN") throw new AuthorizationError();
  await assertGoogleBackupConnected(actor.companyId);
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.companyId + ":scheduled-backup"}))`;
      const config = await tx.accountSettings.findUnique({
        where: { companyId: actor.companyId },
        select: { transactionDefaults: true },
      });
      const settings = backupSettingsSchema.safeParse(
        (config?.transactionDefaults as Record<string, unknown> | null)
          ?.backupSettings,
      );
      if (!force && (!settings.success || !settings.data.autoBackup))
        return false;
      const latest = await tx.accountBackupRecord.findFirst({
        where: {
          companyId: actor.companyId,
          manifest: { path: ["provider"], equals: "GOOGLE_DRIVE" },
        },
        orderBy: { generatedAt: "desc" },
        select: { manifest: true, generatedAt: true },
      });
      const uploadedAt =
        latest?.manifest &&
        typeof latest.manifest === "object" &&
        !Array.isArray(latest.manifest)
          ? latest.manifest.uploadedAt
          : null;
      // A failed/incomplete upload leaves a pending metadata record. Retry hourly,
      // rather than generating another full snapshot on every maintenance tick.
      if (
        !force &&
        latest &&
        !uploadedAt &&
        now.getTime() - latest.generatedAt.getTime() < 3_600_000
      )
        return false;
      if (
        !force &&
        settings.success &&
        typeof uploadedAt === "string" &&
        now.getTime() - Date.parse(uploadedAt) <
          settings.data.intervalDays * 86400000
      )
        return false;
      // Include live attachments; keep only metadata locally, not the backup bundle.
      const backup = await createAccountBackupForActor(
        actor,
        false,
        true,
        "GOOGLE_DRIVE",
      );
      const delivery = await uploadGoogleBackup(actor.companyId, backup);
      await tx.accountBackupRecord.update({
        where: { id: backup.id, companyId: actor.companyId },
        data: {
          manifest: {
            ...backup.manifest,
            ...delivery,
          } as Prisma.InputJsonValue,
        },
      });
      await tx.accountingAuditEvent.create({
        data: {
          companyId: actor.companyId,
          actorUserId: actor.id,
          eventType: "BACKUP_GENERATED",
          entityType: "ACCOUNT_BACKUP_DELIVERY",
          entityId: backup.id,
          metadata: {
            phase: "DELIVERY_CONFIRMED",
            provider: delivery.provider,
            driveFileId: delivery.driveFileId,
          },
        },
      });
      return true;
    },
    { timeout: 180_000 },
  );
}
export async function generateScheduledAccountBackups(now = new Date()) {
  const configs = await db.accountSettings.findMany({
    where: {
      transactionDefaults: {
        path: ["backupSettings", "autoBackup"],
        equals: true,
      },
    },
  });
  let generated = 0,
    requiresGoogleDriveSetup = 0,
    failed = 0;
  for (const config of configs) {
    if (!(await googleBackupStatus(config.companyId)).connected) {
      requiresGoogleDriveSetup++;
      continue;
    }
    const admin = await db.user.findFirst({
      where: {
        companyId: config.companyId,
        isActive: true,
        accountAccessActive: true,
        accountRole: "ACCOUNT_ADMIN",
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, accountRole: true },
    });
    if (!admin) continue;
    try {
      if (
        await runGoogleDriveBackup(
          { ...admin, companyId: config.companyId },
          now,
        )
      )
        generated++;
    } catch {
      failed++;
    }
  }
  return {
    companies: configs.length,
    generated,
    requiresGoogleDriveSetup,
    failed,
  };
}
export async function backupReminderDue(companyId: string, now = new Date()) {
  const [config, latest] = await Promise.all([
    db.accountSettings.findUnique({
      where: { companyId },
      select: { transactionDefaults: true, createdAt: true },
    }),
    db.accountBackupRecord.findFirst({
      where: {
        companyId,
        OR: [
          { manifest: { path: ["provider"], equals: Prisma.AnyNull } },
          { manifest: { path: ["uploadedAt"], not: Prisma.AnyNull } },
        ],
      },
      orderBy: { generatedAt: "desc" },
      select: { generatedAt: true },
    }),
  ]);
  const settings = ((
    config?.transactionDefaults as Record<string, unknown> | null
  )?.backupSettings ?? {}) as Record<string, unknown>;
  if (typeof settings.manualReminderDays !== "number") return false;
  return (
    now.getTime() -
      (latest?.generatedAt ?? config?.createdAt ?? now).getTime() >=
    settings.manualReminderDays * 86400000
  );
}
