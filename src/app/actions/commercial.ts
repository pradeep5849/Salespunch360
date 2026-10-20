"use server";
import { accountAction } from "@/lib/account/action-feedback";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  applyAdvance,
  confirmSalesOrder,
  createCommercialDocument,
  createSettlement,
  finalizeNonFinancialDocument,
  postCommercialDocument,
  schedulePaymentReminder,
  setPaymentReminderStatus,
} from "@/lib/account/commercial";
import {submitSaleForActor} from "@/lib/account/sale-submit";
import {requirePermissionForMutation} from "@/lib/auth/authorization";
import { randomUUID } from "node:crypto";
import {
  commercialActionFailure,
  type CommercialCreateResult,
} from "@/lib/account/commercial-action-errors";
import { logEvent } from "@/lib/logging";
const payload = (form: FormData) => {const input=JSON.parse(String(form.get("payload")));const fields=[...form.entries()].filter(([key])=>key.startsWith("custom_"));return fields.length?{...input,customFields:Object.fromEntries(fields.map(([key,value])=>[key.slice(7),String(value)]))}:input;};
function normalizeClientCommercialInput(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const input = { ...(raw as Record<string, unknown>) };
  if (input.stateOfSupplyCode === "") input.stateOfSupplyCode = undefined;
  if (input.projectId === "") input.projectId = undefined;
  if (input.documentNumber === "") input.documentNumber = undefined;
  return input;
}
async function saveExplicitCommercialDocument(raw:unknown){
 if(raw&&typeof raw==="object"&&!Array.isArray(raw)&&(raw as {type?:unknown}).type==="SALES_INVOICE"){
  const actor=await requirePermissionForMutation("ACCOUNT_JOURNAL_POST");
  return submitSaleForActor(actor as Parameters<typeof submitSaleForActor>[0],normalizeClientCommercialInput(raw));
 }
 return createCommercialDocument(raw);
}
export async function saveCommercialDocument(form: FormData) {
  const row = await saveExplicitCommercialDocument(payload(form));
  redirect(`/workspace/account/transactions/${row.id}`);
}
export async function saveCommercialDocumentWithFeedback(form: FormData) {
  return accountAction(async () => {
    const row = await saveExplicitCommercialDocument(payload(form));
    return `/workspace/account/transactions/${row.id}`;
  }, "Document saved");
}
/** Client sale entry uses the same authoritative creator without forcing a redirect. */
export async function createCommercialDocumentAction(
  raw: unknown,
): Promise<CommercialCreateResult> {
  try {
    const row = await saveExplicitCommercialDocument(
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

/** Explicit Sale Save posts the real sale and optional receipt atomically; no autosave. */
export async function submitSaleInvoiceAction(
  raw: unknown,
  payment?: { receivedAmount?: number; receivedInFull?:boolean; paymentType?: string; chequeNumber?: string; chequeDate?: string; moneyAccountId?: string; reference?: string },
): Promise<CommercialCreateResult> {
  try {
    const normalized = normalizeClientCommercialInput(raw);
    if (
      !normalized ||
      typeof normalized !== "object" ||
      Array.isArray(normalized)
    ) {
      throw new Error("INVALID_INPUT");
    }
    const actor=await requirePermissionForMutation("ACCOUNT_JOURNAL_POST");
    const row=await submitSaleForActor(actor as Parameters<typeof submitSaleForActor>[0],normalized,payment??{});
    revalidatePath("/workspace/account/transactions");
    revalidatePath(`/workspace/account/transactions/${row.id}`);
    return { ok: true, id: row.id, documentNumber: row.documentNumber };
  } catch (error) {
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
export async function saveSettlementWithFeedback(form: FormData) {
  return accountAction(async () => {
    await createSettlement(payload(form));
    return "/workspace/account/transactions";
  }, "Payment posted");
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

export async function confirmSalesOrderAction(form:FormData){
 await confirmSalesOrder({documentId:String(form.get("id"))});
 revalidatePath("/workspace/account/quotations");
 revalidatePath(`/workspace/account/transactions/${String(form.get("id"))}`);
}
