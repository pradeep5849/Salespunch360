import type { ExpenseTransactionStatus } from "@prisma/client";
import { canUsePermission } from "@/lib/auth/permissions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  addExpenseAttachmentForActor,
  deactivateExpenseCategoryForActor,
  createExpenseForActor,
  createRecurringTemplateForActor,
  downloadExpenseAttachmentForActor,
  saveExpenseCategoryForActor,
  expenseOptionsForActor,
  getExpenseForActor,
  listExpensesForActor,
  postExpenseForActor,
  reverseExpenseForActor,
  transitionExpenseForActor,
  updateExpenseForActor,
} from "@/lib/account/expenses";
import { db } from "@/lib/db";
import { requireAccountModules } from "@/lib/account/modules";
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
  const rows = await listExpensesForActor(permit(u, "ACCOUNT_EXPENSE_VIEW"));
  return rows.filter(
    (x) =>
      (!status || x.status === status) &&
      (!q ||
        x.transactionNumber.toLowerCase().includes(q.toLowerCase()) ||
        (x.reference ?? "").toLowerCase().includes(q.toLowerCase())),
  );
}
export async function mobileExpenseDetail(u: MobileAppPrincipal, id: string) {
  const a = permit(u, "ACCOUNT_EXPENSE_VIEW"),
    expense = await getExpenseForActor(a, id),
    [attachments, history] = await Promise.all([
      db.expenseAttachment.findMany({
        where: { companyId: a.companyId, expenseId: id },
        orderBy: { createdAt: "desc" },
      }),
      db.accountOperationalAudit.findMany({
        where: { companyId: a.companyId, entityType: "EXPENSE", entityId: id },
        orderBy: { createdAt: "desc" },
      }),
    ]);
  return { ...expense, attachments, history };
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
    return transitionExpenseForActor(permit(u, p), id, d.status);
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
  const a = permit(u, "ACCOUNT_EXPENSE_VIEW");
  await requireAccountModules(a, "EXPENSES");
  const [categories, ledgers] = await Promise.all([
    db.expenseCategory.findMany({
      where: {
        companyId: a.companyId,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    db.ledgerAccount.findMany({
      where: {
        companyId: a.companyId,
        isActive: true,
        allowPosting: true,
        accountClass: { in: ["EXPENSE", "INCOME"] },
      },
      select: { id: true, name: true, code: true, accountClass: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { categories, ledgers };
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
