"use server";
import { expenseFormInput } from "@/lib/account/expense-input";
import { revalidatePath } from "next/cache";
import { accountAction } from "@/lib/account/action-feedback";
import {
  addExpenseAttachment,
  createExpense,
  updateExpense,
  createRecurringTemplate,
  deactivateExpenseCategory,
  generateRecurringExpense,
  postExpense,
  reverseExpense,
  saveExpenseCategory,
  transitionExpense,
} from "@/lib/account/expenses";
const raw = (fd: FormData) => Object.fromEntries(fd.entries());
export async function createExpenseAction(fd: FormData) {
  return accountAction(async () => {
    const row = await createExpense(expenseFormInput(fd));
    revalidatePath("/workspace/account/expenses");
    return fd.get("saveMode") === "new"
      ? `/workspace/account/expenses/new?saved=${row.id}`
      : `/workspace/account/expenses/${row.id}`;
  }, "Draft saved with server-calculated totals.");
}
export async function updateExpenseAction(fd: FormData) {
  return accountAction(async () => {
    const id = String(fd.get("id"));
    await updateExpense(id, expenseFormInput(fd));
    revalidatePath(`/workspace/account/expenses/${id}`);
    return `/workspace/account/expenses/${id}`;
  }, "Draft updated.");
}
export async function expenseLifecycleAction(fd: FormData) {
  return accountAction(async () => {
    const id = String(fd.get("id")),
      op = String(fd.get("operation"));
    if (op === "POSTED") await postExpense(id);
    else if (op === "REVERSED")
      await reverseExpense(
        id,
        new Date(String(fd.get("entryDate"))),
        String(fd.get("reason")),
      );
    else
      await transitionExpense(
        id,
        op as never,
        fd.get("reason") ? String(fd.get("reason")) : undefined,
      );
    revalidatePath(`/workspace/account/expenses/${id}`);
  }, "Expense action confirmed.");
}
export async function expenseAttachmentAction(fd: FormData) {
  return accountAction(async () => {
    const id = String(fd.get("id")),
      file = fd.get("file");
    if (!(file instanceof File)) throw new Error("INVALID_EXPENSE_ATTACHMENT");
    await addExpenseAttachment(id, file);
    revalidatePath(`/workspace/account/expenses/${id}`);
  }, "Attachment uploaded.");
}
export async function categoryAction(fd: FormData) {
  return accountAction(async () => {
    if (fd.get("operation") === "deactivate")
      await deactivateExpenseCategory(String(fd.get("id")));
    else
      await saveExpenseCategory(
        Object.fromEntries(
          [...fd.entries()].filter(([k]) => !["id", "operation"].includes(k)),
        ),
        fd.get("id") ? String(fd.get("id")) : undefined,
      );
    revalidatePath("/workspace/account/expenses/categories");
    revalidatePath("/workspace/account/expenses/new");
  }, "Category saved.");
}
export async function recurringAction(fd: FormData) {
  if (fd.get("operation") === "generate")
    await generateRecurringExpense(
      String(fd.get("templateId")),
      String(fd.get("moneyAccountId")),
    );
  else await createRecurringTemplate(raw(fd));
  revalidatePath("/workspace/account/expenses/recurring");
}
