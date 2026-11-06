import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { privateStorage } from "@/lib/storage";
import { createAllocatedPaymentForActor } from "./allocated-payment";
import { settlementInput } from "./commercial";
import { preparePrivateDocumentFiles } from "./private-document-files";
import { inAccountTransaction } from "./transaction-scope";
import type { ProjectActor } from "./projects";
import { homeSettlementProjectScope } from "./home-settlement-scope";
import { requireAccountModules } from "./modules";

/** Supporting evidence is committed with its payment, never a second cash operation. */
export async function submitPaymentForActor(
  actor: ProjectActor,
  raw: unknown,
  files: File[] = [],
) {
  if (
    !["ACCOUNT_ADMIN", "ACCOUNTANT"].includes(actor.accountRole ?? "") ||
    !canUsePermission(
      actor,
      "SALESPUNCH360_ACCOUNT",
      "ACCOUNT_SETTLEMENT_ENTRY",
    )
  )
    throw new AuthorizationError();
  const input = settlementInput.parse(raw);
  if (
    actor.branchAccessScope === "SELECTED_BRANCHES" &&
    !actor.branchIds?.includes(input.branchId)
  )
    throw new AuthorizationError();
  const prepared = await preparePrivateDocumentFiles(
    files,
    (kind) =>
      new Error(
        kind === "LIMIT"
          ? "PAYMENT_ATTACHMENT_LIMIT"
          : "INVALID_PAYMENT_ATTACHMENT",
      ),
  );
  const manifest = prepared.map(
    ({ displayName, mimeType, sizeBytes, contentHash }) => ({
      displayName,
      mimeType,
      sizeBytes,
      contentHash,
    }),
  );
  const requestHash = createHash("sha256")
      .update(JSON.stringify({ input, manifest }))
      .digest("hex"),
    attempted = new Set<string>();
  try {
    return await inAccountTransaction(
      undefined,
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM companies WHERE id=${actor.companyId}::uuid FOR UPDATE`;
        const payment = await createAllocatedPaymentForActor(actor, input, tx);
        const previous = await tx.accountOperationalAudit.findFirst({
          where: {
            companyId: actor.companyId,
            eventType: "PAYMENT_SUPPORT_SAVED",
            entityType: "PAYMENT_SUBMISSION",
            entityId: payment.id,
          },
          select: { metadata: true },
        });
        if (previous) {
          if (
            (previous.metadata as { requestHash?: string } | null)
              ?.requestHash !== requestHash
          )
            throw new Error("IDEMPOTENCY_KEY_REUSED");
          return payment;
        }
        if (prepared.length) {
          await tx.$executeRaw`SELECT set_config('app.payment_attachment_save_id',${payment.id},true)`;
          for (const [position, file] of prepared.entries()) {
            const storageKey = `companies/${actor.companyId}/payment-files/${randomUUID()}`;
            attempted.add(storageKey);
            await privateStorage().put(storageKey, file.bytes);
            await tx.paymentAttachment.create({
              data: {
                companyId: actor.companyId,
                settlementId: payment.id,
                uploadedById: actor.id,
                position,
                storageKey,
                displayName: file.displayName,
                mimeType: file.mimeType,
                sizeBytes: file.sizeBytes,
                contentHash: file.contentHash,
              },
            });
          }
        }
        await tx.accountOperationalAudit.create({
          data: {
            companyId: actor.companyId,
            actorUserId: actor.id,
            eventType: "PAYMENT_SUPPORT_SAVED",
            entityType: "PAYMENT_SUBMISSION",
            entityId: payment.id,
            metadata: {
              requestKey: input.idempotencyKey,
              requestHash,
              files: manifest,
            },
          },
        });
        return payment;
      },
      { timeout: 30000 },
    );
  } finally {
    // A lost commit response must never delete successfully committed evidence.
    for (const storageKey of attempted)
      await db
        .$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM companies WHERE id=${actor.companyId}::uuid FOR UPDATE`;
            if (
              !(await tx.paymentAttachment.count({
                where: { companyId: actor.companyId, storageKey },
              }))
            )
              await privateStorage().delete(storageKey);
          },
          { timeout: 30000 },
        )
        .catch(() => undefined);
  }
}

export async function downloadPaymentAttachmentForActor(
  actor: ProjectActor,
  id: string,
) {
  if (!canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_LEDGER_VIEW"))
    throw new AuthorizationError();
  const project = await homeSettlementProjectScope(actor);
  const row = await db.paymentAttachment.findFirst({
    where: {
      id: z.string().guid().parse(id),
      companyId: actor.companyId,
      settlement: {
        ...(actor.branchAccessScope === "SELECTED_BRANCHES"
          ? { branchId: { in: actor.branchIds ?? [] } }
          : {}),
        ...project,
      },
    },
    select: {
      displayName: true,
      mimeType: true,
      sizeBytes: true,
      contentHash: true,
      storageKey: true,
      settlement: { select: { type: true } },
    },
  });
  if (!row) throw new AuthorizationError();
  await requireAccountModules(
    actor,
    (
      {
        CUSTOMER_RECEIPT: "CUSTOMER_RECEIPTS",
        CUSTOMER_ADVANCE: "CUSTOMER_ADVANCES",
        VENDOR_PAYMENT: "VENDOR_PAYMENTS",
        VENDOR_ADVANCE: "VENDOR_ADVANCES",
      } as const
    )[row.settlement.type],
  );
  if (!row.storageKey.startsWith(`companies/${actor.companyId}/payment-files/`))
    throw new Error("PAYMENT_ATTACHMENT_UNAVAILABLE");
  const bytes = await privateStorage().get(row.storageKey);
  if (
    bytes.length !== row.sizeBytes ||
    createHash("sha256").update(bytes).digest("hex") !== row.contentHash
  )
    throw new Error("PAYMENT_ATTACHMENT_UNAVAILABLE");
  return { bytes, displayName: row.displayName, mimeType: row.mimeType };
}
