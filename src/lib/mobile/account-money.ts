import { canUsePermission } from "@/lib/auth/permissions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  createAndReceiveLoanForActor,
  createMoneyAccountForActor,
  createMoneyTransferForActor,
  deactivateMoneyAccountForActor,
  listMoneyDataForActor,
  moneyDashboardForActor,
  postLoanPaymentForActor,
  postOwnerTransactionForActor,
  setupOwnerFinancialAccountForActor,
  updateMoneyAccountForActor,
} from "@/lib/account/money";
import { db } from "@/lib/db";
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
const write = async (u: MobileAppPrincipal) =>
  assertOperationalWrite(u.companyId);
export async function mobileMoneyContext(u: MobileAppPrincipal) {
  const a = permit(u, "ACCOUNT_MONEY_VIEW"),
    data = await listMoneyDataForActor(a),
    scope =
      a.branchAccessScope === "SELECTED_BRANCHES"
        ? { branchId: { in: a.branchIds ?? [] } }
        : {},
    loanIds = data.loans.map((x) => x.id),
    ownerIds = data.owners.map((x) => x.userId);
  const [transfers, ownerTransactions, loanPayments, users] = await Promise.all(
    [
      db.moneyTransfer.findMany({
        where: { companyId: a.companyId, ...scope },
        orderBy: { transferDate: "desc" },
        take: 200,
      }),
      db.ownerTransaction.findMany({
        where: { companyId: a.companyId, ...scope },
        orderBy: { transactionDate: "desc" },
        take: 200,
      }),
      db.loanPayment.findMany({
        where: { companyId: a.companyId, loanId: { in: loanIds } },
        orderBy: { paymentDate: "desc" },
        take: 200,
      }),
      db.user.findMany({
        where: { companyId: a.companyId, id: { in: ownerIds } },
        select: { id: true, name: true },
      }),
    ],
  );
  return {
    ...data,
    owners: data.owners.map((x) => ({
      ...x,
      name: users.find((u) => u.id === x.userId)?.name ?? "Owner",
    })),
    transfers,
    ownerTransactions,
    loanPayments,
  };
}
export async function mobileCreateMoneyAccount(
  u: MobileAppPrincipal,
  raw: unknown,
) {
  await write(u);
  return createMoneyAccountForActor(permit(u, "ACCOUNT_MONEY_ENTRY"), raw);
}
export async function mobileUpdateMoneyAccount(
  u: MobileAppPrincipal,
  id: string,
  raw: unknown,
) {
  await write(u);
  const a = permit(u, "ACCOUNT_MONEY_ENTRY");
  await updateMoneyAccountForActor(a, id, raw);
  return moneyDashboardForActor(a);
}
export async function mobileDisableMoneyAccount(
  u: MobileAppPrincipal,
  id: string,
) {
  await write(u);
  await deactivateMoneyAccountForActor(permit(u, "ACCOUNT_MONEY_ENTRY"), id);
  return { ok: true };
}
export async function mobileMoneyTransfer(u: MobileAppPrincipal, raw: unknown) {
  await write(u);
  return createMoneyTransferForActor(permit(u, "ACCOUNT_MONEY_ENTRY"), raw);
}
export async function mobileOwnerTransaction(
  u: MobileAppPrincipal,
  raw: unknown,
) {
  await write(u);
  return postOwnerTransactionForActor(permit(u, "ACCOUNT_LOAN_ADMIN"), raw);
}
export async function mobileLoan(u: MobileAppPrincipal, raw: unknown) {
  await write(u);
  return createAndReceiveLoanForActor(permit(u, "ACCOUNT_LOAN_ADMIN"), raw);
}
export async function mobileLoanPayment(u: MobileAppPrincipal, raw: unknown) {
  await write(u);
  return postLoanPaymentForActor(permit(u, "ACCOUNT_LOAN_ADMIN"), raw);
}

export async function mobileOwnerSetup(u: MobileAppPrincipal, raw: unknown) {
  await write(u);
  const d = raw as { userId?: string; branchId?: string };
  if (!d.userId || !d.branchId) throw new Error("INVALID_INPUT");
  return setupOwnerFinancialAccountForActor(
    permit(u, "ACCOUNT_LOAN_ADMIN"),
    d.userId,
    d.branchId,
  );
}
