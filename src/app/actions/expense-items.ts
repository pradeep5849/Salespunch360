"use server";
import {
  requirePermission,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { accountErrorMessage } from "@/lib/account/action-feedback";
import {
  createExpenseItemForActor,
  listExpenseItemsForActor,
} from "@/lib/account/expense-items";
import type { ProjectActor } from "@/lib/account/projects";
import { isRedirectError } from "next/dist/client/components/redirect-error";
export async function createExpenseItemAction(form: FormData) {
  try {
    const actor = (await requirePermissionForMutation(
      "ACCOUNT_EXPENSE_ENTRY",
    )) as ProjectActor;
    const photo = form.get("photo");
    return {
      item: await createExpenseItemForActor(
        actor,
        { name: form.get("name"), requestKey: form.get("requestKey") },
        photo instanceof File ? photo : null,
      ),
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: accountErrorMessage(error) };
  }
}
export async function searchExpenseItemsAction(q: string) {
  return listExpenseItemsForActor(
    (await requirePermission("ACCOUNT_EXPENSE_VIEW")) as ProjectActor,
    { q, limit: 25 },
  );
}
