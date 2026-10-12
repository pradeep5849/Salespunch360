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
  setRecurringTemplateActive,
  postExpense,
  reverseExpense,
  saveExpenseCategory,
  transitionExpense,
} from "@/lib/account/expenses";
const raw = (fd: FormData) =>
  Object.fromEntries(
    [...fd.entries()].filter(
      ([key]) =>
        !key.startsWith("$ACTION_") && !["operation", "id"].includes(key),
    ),
  );
export async function createExpenseAction(fd: FormData) {
  return accountAction(
    async () => {
      const row = await createExpense(expenseFormInput(fd));
      revalidatePath("/workspace/account/expenses");
      return fd.get("saveMode") === "new"
        ? `/workspace/account/expenses/new?saved=${row.id}&branchId=${row.branchId}`
        : `/workspace/account/expenses/${row.id}`;
    },
    fd.get("recordAsPaid") === "true"
      ? "Payment recorded with server-calculated totals."
      : "Draft saved with server-calculated totals.",
  );
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
  return accountAction(async () => {
    if (fd.get("operation") === "generate") {
      const expense = await generateRecurringExpense(
        String(fd.get("templateId")),
        String(fd.get("moneyAccountId")),
        String(fd.get("expectedDueDate")),
      );
      revalidatePath("/workspace/account/expenses/recurring");
      return `/workspace/account/expenses/${expense.id}`;
    } else if (fd.get("operation") === "active")
      await setRecurringTemplateActive(
        String(fd.get("id")),
        fd.get("isActive") === "true",
      );
    else await createRecurringTemplate(raw(fd));
    revalidatePath("/workspace/account/expenses/recurring");
  }, "Recurring schedule saved.");
}
