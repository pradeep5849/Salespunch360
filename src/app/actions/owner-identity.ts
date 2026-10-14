"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermissionForMutation } from "@/lib/auth/authorization";
import {
  createOwnerFinancialAccountForActor,
  updateOwnerFinancialAccountForActor,
  postOwnerTransactionForActor,
} from "@/lib/account/money";
import { accountErrorMessage } from "@/lib/account/action-feedback";
import type { ProjectActor } from "@/lib/account/projects";
export async function saveOwnerIdentityAction(id: string | null, raw: unknown) {
  try {
    const actor = (await requirePermissionForMutation(
      "ACCOUNT_LOAN_ADMIN",
    )) as ProjectActor;
    const row = id
      ? await updateOwnerFinancialAccountForActor(actor, id, raw)
      : await createOwnerFinancialAccountForActor(actor, raw);
    revalidatePath("/workspace/account/money/capital");
    return {
      kind: "success" as const,
      message: id ? "Owner / partner saved" : "Owner / partner added",
      id: row.id,
    };
  } catch (error) {
    return {
      kind: "error" as const,
      message: accountErrorMessage(error),
      fieldErrors:
        error instanceof z.ZodError ? error.flatten().fieldErrors : {},
    };
  }
}
export async function postOwnerEntryAction(raw: unknown) {
  try {
    const actor = (await requirePermissionForMutation(
      "ACCOUNT_MONEY_ENTRY",
    )) as ProjectActor;
    const row = await postOwnerTransactionForActor(actor, raw);
    revalidatePath("/workspace/account/money/capital");
    revalidatePath("/workspace/account/money");
    return {
      kind: "success" as const,
      message: "Owner transaction posted",
      id: row.id,
    };
  } catch (error) {
    return {
      kind: "error" as const,
      message: accountErrorMessage(error),
      fieldErrors:
        error instanceof z.ZodError ? error.flatten().fieldErrors : {},
    };
  }
}
