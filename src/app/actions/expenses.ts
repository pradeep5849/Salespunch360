"use server";
import { expenseFormInput } from "@/lib/account/expense-input";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addExpenseAttachment,
  createExpense,
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
  const row = await createExpense(expenseFormInput(fd));
  redirect(`/workspace/account/expenses/${row.id}`);
}
export async function expenseLifecycleAction(fd: FormData) {
  const id = String(fd.get("id")),
    op = String(fd.get("operation"));
  if (op === "POSTED") await postExpense(id);
  else if (op === "REVERSED")
    await reverseExpense(
      id,
      new Date(String(fd.get("entryDate"))),
      String(fd.get("reason")),
    );
  else await transitionExpense(id, op as never);
  revalidatePath(`/workspace/account/expenses/${id}`);
}
export async function expenseAttachmentAction(fd: FormData) {
  const id = String(fd.get("id")),
    file = fd.get("file");
  if (!(file instanceof File)) throw new Error("INVALID_EXPENSE_ATTACHMENT");
  await addExpenseAttachment(id, file);
  revalidatePath(`/workspace/account/expenses/${id}`);
}
export async function categoryAction(fd: FormData) {
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
