"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  applyAdvance,
  createCommercialDocument,
  createSettlement,
  finalizeNonFinancialDocument,
  postCommercialDocument,
  schedulePaymentReminder,
  setPaymentReminderStatus,
} from "@/lib/account/commercial";
import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";
import {
  commercialActionFailure,
  type CommercialCreateResult,
} from "@/lib/account/commercial-action-errors";
import { logEvent } from "@/lib/logging";
const payload = (form: FormData) => JSON.parse(String(form.get("payload")));
function normalizeClientCommercialInput(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const input = { ...(raw as Record<string, unknown>) };
  if (input.stateOfSupplyCode === "") input.stateOfSupplyCode = undefined;
  if (input.projectId === "") input.projectId = undefined;
  if (input.documentNumber === "") input.documentNumber = undefined;
  return input;
}
export async function saveCommercialDocument(form: FormData) {
  const row = await createCommercialDocument(payload(form));
  redirect(`/workspace/account/transactions/${row.id}`);
}
/** Client sale entry uses the same authoritative creator without forcing a redirect. */
export async function createCommercialDocumentAction(
  raw: unknown,
): Promise<CommercialCreateResult> {
  try {
    const row = await createCommercialDocument(
      normalizeClientCommercialInput(raw),
    );
    return { ok: true, id: row.id, documentNumber: row.documentNumber };
  } catch (error) {
    const result = commercialActionFailure(error);
    const correlationId = randomUUID();
    logEvent("error", {
      category: "COMMERCIAL_DOCUMENT_CREATE",
      code: result.errorCode,
      correlationId,
    });
    console.error("Commercial document create failed", correlationId, error);
    return result;
  }
}

/**
 * Normal Sale Save is a final submit: create + post, then allocate any amount
 * marked Received. The client never autosaves, so leaving the editor without
 * pressing Save creates nothing. If posting fails, a newly-created draft is
 * removed best-effort instead of leaving a normal sale visible as Draft.
 */
export async function submitSaleInvoiceAction(
  raw: unknown,
  payment?: { receivedAmount?: number; paymentType?: string },
): Promise<CommercialCreateResult> {
  let createdId = "";
  try {
    const normalized = normalizeClientCommercialInput(raw);
    if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
      throw new Error("INVALID_INPUT");
    }
    const input = normalized as Record<string, unknown>;
    if (input.type !== "SALES_INVOICE") throw new Error("INVALID_INPUT");
    const row = await createCommercialDocument(input);
    createdId = row.id;
    await postCommercialDocument({ documentId: row.id });

    const received = Number(payment?.receivedAmount ?? 0);
    if (Number.isFinite(received) && received > 0) {
      const paymentMode = payment?.paymentType === "CASH" ? "CASH" : "BANK";
      await createSettlement({
        idempotencyKey: `sale-save-receipt:${row.id}`,
        type: "CUSTOMER_RECEIPT",
        branchId: String(input.branchId),
        partyId: String(input.partyId),
        paymentMode,
        amount: received.toFixed(2),
        transactionDate: String(input.issueDate),
        allocations: [{ documentId: row.id, amount: received.toFixed(2) }],
      });
    }

    revalidatePath("/workspace/account/transactions");
    revalidatePath(`/workspace/account/transactions/${row.id}`);
    return { ok: true, id: row.id, documentNumber: row.documentNumber };
  } catch (error) {
    if (createdId) {
      try {
        await db.commercialDocument.deleteMany({ where: { id: createdId, status: "DRAFT" } });
      } catch (cleanupError) {
        console.error("Sale draft cleanup failed", createdId, cleanupError);
      }
    }
    const result = commercialActionFailure(error);
    const correlationId = randomUUID();
    logEvent("error", {
      category: "SALE_INVOICE_SUBMIT",
      code: result.errorCode,
      correlationId,
    });
    console.error("Sale invoice submit failed", correlationId, error);
    return result;
  }
}

export async function finalizeCommercialAction(form: FormData) {
  const id = String(form.get("id"));
  await finalizeNonFinancialDocument({ documentId: id });
  revalidatePath(`/workspace/account/transactions/${id}`);
}
export async function postCommercialAction(form: FormData) {
  const id = String(form.get("id"));
  await postCommercialDocument({ documentId: id });
  revalidatePath(`/workspace/account/transactions/${id}`);
}
export async function saveSettlementAction(form: FormData) {
  await createSettlement(payload(form));
  redirect("/workspace/account/transactions");
}
export async function applyAdvanceAction(form: FormData) {
  const documentId = String(form.get("documentId"));
  await applyAdvance({
    advanceId: String(form.get("advanceId")),
    documentId,
    amount: String(form.get("amount")),
    applicationDate: String(form.get("applicationDate")),
    idempotencyKey: String(form.get("idempotencyKey")),
  });
  redirect(`/workspace/account/transactions/${documentId}`);
}
export async function saveReminderAction(form: FormData) {
  const documentId = String(form.get("documentId"));
  await schedulePaymentReminder({
    documentId,
    remindAt: String(form.get("remindAt")),
    message: String(form.get("message")),
  });
  revalidatePath(`/workspace/account/transactions/${documentId}`);
}
export async function reminderStatusAction(form: FormData) {
  const reminder = await setPaymentReminderStatus({
    id: String(form.get("id")),
    status: String(form.get("status")),
  });
  revalidatePath(`/workspace/account/transactions/${reminder.documentId}`);
}
