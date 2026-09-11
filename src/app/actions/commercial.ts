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
const payload = (form: FormData) => JSON.parse(String(form.get("payload")));
export async function saveCommercialDocument(form: FormData) {
  const row = await createCommercialDocument(payload(form));
  redirect(`/workspace/account/transactions/${row.id}`);
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
