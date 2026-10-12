import { z } from "zod";
import type { ExpenseTransactionStatus } from "@prisma/client";
import { canUsePermission } from "@/lib/auth/permissions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  addExpenseAttachmentForActor,
  deactivateExpenseCategoryForActor,
  createExpenseForActor,
  createRecurringTemplateForActor,
  recurringTemplatesForActor,
  setRecurringTemplateActiveForActor,
  generateRecurringExpenseForActor,
  downloadExpenseAttachmentForActor,
  saveExpenseCategoryForActor,
  expenseOptionsForActor,
  expenseCategoryOptionsForActor,
  getExpenseForActor,
  expensePageForActor,
  expenseSummaryForActor,
  expenseListQuerySchema,
  postExpenseForActor,
  reverseExpenseForActor,
  transitionExpenseForActor,
  updateExpenseForActor,
} from "@/lib/account/expenses";
import { requireAccountModules } from "@/lib/account/modules";
import { resolveAccountBranchContext } from "@/lib/account/branch-context";
import { mobileAccountActor } from "./account-transactions";
import type { MobileAppPrincipal } from "./auth";
function permit(
  u: MobileAppPrincipal,
  p: Parameters<typeof canUsePermission>[2],
) {
  const a = mobileAccountActor(u);
  if (!canUsePermission(a, u.productEdition, p))
    throw new Error("MOBILE_FORBIDDEN");
  return a;
}
export async function mobileExpenseList(
  u: MobileAppPrincipal,
  q?: string | null,
  status?: string | null,
) {
  return (
    await mobileExpensePage(u, {
      q: q || undefined,
      status: status || undefined,
      limit: 200,
    })
  ).rows;
}
export async function mobileExpensePage(u: MobileAppPrincipal, raw: unknown) {
  const a = permit(u, "ACCOUNT_EXPENSE_VIEW");
  const { scope, ...query } = expenseListQuerySchema
    .extend({ scope: z.literal("all").optional() })
    .parse(raw);
  const scoped = await resolveAccountBranchContext(a, {
    scope,
    branchId: query.branchId,
  });
  return expensePageForActor(a, {
    ...query,
    branchId:
      scoped.context.mode === "BRANCH" ? scoped.context.branchId : undefined,
  });
}
export async function mobileExpenseDetail(u: MobileAppPrincipal, id: string) {
  return getExpenseForActor(permit(u, "ACCOUNT_EXPENSE_VIEW"), id);
}
export async function mobileExpenseOptions(u: MobileAppPrincipal) {
  return expenseOptionsForActor(permit(u, "ACCOUNT_EXPENSE_VIEW"));
}
export async function mobileCreateExpense(u: MobileAppPrincipal, raw: unknown) {
  await assertOperationalWrite(u.companyId);
  return createExpenseForActor(permit(u, "ACCOUNT_EXPENSE_ENTRY"), raw);
}
export async function mobileUpdateExpense(
  u: MobileAppPrincipal,
  id: string,
  raw: unknown,
) {
  await assertOperationalWrite(u.companyId);
  const actor = permit(u, "ACCOUNT_EXPENSE_ENTRY");
  await updateExpenseForActor(actor, id, raw);
  return getExpenseForActor(actor, id);
}
export async function mobileExpenseAction(
  u: MobileAppPrincipal,
  id: string,
  raw: unknown,
) {
  await assertOperationalWrite(u.companyId);
  const d = raw as {
    action?: string;
    status?: ExpenseTransactionStatus;
    entryDate?: string;
    reason?: string;
  };
  if (d.action === "TRANSITION" && d.status) {
    const p = ["APPROVED", "REJECTED"].includes(d.status)
      ? "ACCOUNT_EXPENSE_APPROVE"
      : "ACCOUNT_EXPENSE_ENTRY";
    return transitionExpenseForActor(permit(u, p), id, d.status, d.reason);
  }
  if (d.action === "POST")
    return postExpenseForActor(permit(u, "ACCOUNT_EXPENSE_ENTRY"), id);
  if (d.action === "REVERSE" && d.entryDate && d.reason)
    return reverseExpenseForActor(
      permit(u, "ACCOUNT_EXPENSE_APPROVE"),
      id,
      new Date(d.entryDate),
      d.reason,
    );
  throw new Error("INVALID_INPUT");
}
export async function mobileRecurringExpense(
  u: MobileAppPrincipal,
  raw: unknown,
) {
  await assertOperationalWrite(u.companyId);
  return createRecurringTemplateForActor(
    permit(u, "ACCOUNT_EXPENSE_ENTRY"),
    raw,
  );
}
export async function mobileExpenseUpload(
  u: MobileAppPrincipal,
  id: string,
  file: File,
) {
  await assertOperationalWrite(u.companyId);
  return addExpenseAttachmentForActor(
    permit(u, "ACCOUNT_EXPENSE_ENTRY"),
    id,
    file,
  );
}
export async function mobileExpenseDownload(u: MobileAppPrincipal, id: string) {
  return downloadExpenseAttachmentForActor(
    permit(u, "ACCOUNT_EXPENSE_VIEW"),
    id,
  );
}
export async function mobileExpenseCategories(
  u: MobileAppPrincipal,
  q?: string | null,
) {
  const actor = permit(u, "ACCOUNT_EXPENSE_VIEW");
  const [options, summary] = await Promise.all([
    expenseCategoryOptionsForActor(actor, q ?? ""),
    expenseSummaryForActor(actor, {}, q ?? ""),
  ]);
  return { ...options, summary };
}
export async function mobileSaveExpenseCategory(
  u: MobileAppPrincipal,
  raw: unknown,
  id?: string,
) {
  await assertOperationalWrite(u.companyId);
  const actor = permit(u, "ACCOUNT_EXPENSE_APPROVE");
  await requireAccountModules(actor, "EXPENSES");
  const result = await saveExpenseCategoryForActor(actor, raw, id);
  return result ?? { ok: true };
}
export async function mobileDeactivateExpenseCategory(
  u: MobileAppPrincipal,
  id: string,
) {
  await assertOperationalWrite(u.companyId);
  const actor = permit(u, "ACCOUNT_EXPENSE_APPROVE");
  await requireAccountModules(actor, "EXPENSES");
  await deactivateExpenseCategoryForActor(actor, id);
  return { ok: true };
}

export async function mobileRecurringExpenseList(u: MobileAppPrincipal) {
  return recurringTemplatesForActor(permit(u, "ACCOUNT_EXPENSE_VIEW"));
}
export async function mobileRecurringExpenseAction(
  u: MobileAppPrincipal,
  id: string,
  raw: unknown,
) {
  await assertOperationalWrite(u.companyId);
  const a = permit(u, "ACCOUNT_EXPENSE_ENTRY");
  const input = recurringActionSchema.parse(raw);
  if (input.action === "ACTIVE") {
    await setRecurringTemplateActiveForActor(a, id, input.isActive);
    return { ok: true };
  }
  return generateRecurringExpenseForActor(
    a,
    id,
    input.moneyAccountId,
    input.expectedDueDate,
  );
}

const recurringActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ACTIVE"), isActive: z.boolean() }).strict(),
  z
    .object({
      action: z.literal("GENERATE"),
      moneyAccountId: z.string().uuid(),
      expectedDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .strict(),
]);
