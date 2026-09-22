import { Prisma, type AssetStatus } from "@prisma/client";
import { canUsePermission } from "@/lib/auth/permissions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  accountingOverviewForActor,
  createCostCentreForActor,
  createLedgerAccountForActor,
  postJournalForActor,
  postOpeningBalancesForActor,
  reverseJournalForActor,
  setPeriodLockForActor,
} from "@/lib/accounting/service";
import {
  assetOptionsForActor,
  assignAssetForActor,
  createAssetForActor,
  getAssetForActor,
  returnAssetForActor,
  setAssetStatusForActor,
  updateAssetForActor,
} from "@/lib/account/assets";
import { createFinancialYearForActor } from "@/lib/account/service";
import { closeFinancialYearForActor } from "@/lib/account/utilities";
import { requireAccountModules } from "@/lib/account/modules";
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
const write = (u: MobileAppPrincipal) => assertOperationalWrite(u.companyId);
const branchScope = (a: ReturnType<typeof mobileAccountActor>) =>
  a.branchAccessScope === "SELECTED_BRANCHES"
    ? { branchId: { in: a.branchIds ?? [] } }
    : {};
export async function mobileAccountingOverview(u: MobileAppPrincipal) {
  const a = permit(u, "ACCOUNT_LEDGER_VIEW"),
    data = await accountingOverviewForActor(a),
    totals = await db.journalLine.groupBy({
      by: ["ledgerAccountId"],
      where: {
        companyId: a.companyId,
        journalEntry: { status: "POSTED", ...branchScope(a) },
      },
      _sum: { debit: true, credit: true },
    }),
    balance = new Map(
      totals.map((x) => [
        x.ledgerAccountId,
      new Prisma.Decimal(x._sum.debit ?? 0).sub(x._sum.credit ?? 0),
      ]),
    );
  return {
    ...data,
    ledgerAccounts: data.ledgerAccounts.map((x) => ({
      ...x,
      balance: balance.get(x.id) ?? 0,
    })),
  };
}
export async function mobileJournalDetail(u: MobileAppPrincipal, id: string) {
  const a = permit(u, "ACCOUNT_LEDGER_VIEW"),
    row = await db.journalEntry.findFirst({
      where: { id, companyId: a.companyId, ...branchScope(a) },
      include: {
        lines: { include: { ledgerAccount: true, costCentre: true } },
        reversalOf: true,
        reversedBy: true,
      },
    });
  if (!row) throw new Error("MOBILE_FORBIDDEN");
  return row;
}
export async function mobileLedger(u: MobileAppPrincipal, raw: unknown) {
  await write(u);
  return createLedgerAccountForActor(permit(u, "ACCOUNT_CHART_ADMIN"), raw);
}
export async function mobileCostCentre(u: MobileAppPrincipal, raw: unknown) {
  await write(u);
  return createCostCentreForActor(permit(u, "ACCOUNT_CHART_ADMIN"), raw);
}
export async function mobileJournal(
  u: MobileAppPrincipal,
  raw: unknown,
  opening = false,
) {
  await write(u);
  const a = permit(
    u,
    opening ? "ACCOUNT_OPENING_BALANCE" : "ACCOUNT_JOURNAL_POST",
  );
  return opening
    ? postOpeningBalancesForActor(a, raw)
    : postJournalForActor(a, raw);
}
export async function mobileReverseJournal(
  u: MobileAppPrincipal,
  raw: unknown,
) {
  await write(u);
  return reverseJournalForActor(permit(u, "ACCOUNT_JOURNAL_REVERSE"), raw);
}
export async function mobilePeriodLock(u: MobileAppPrincipal, raw: unknown) {
  await write(u);
  return setPeriodLockForActor(permit(u, "ACCOUNT_PERIOD_LOCK"), raw);
}
export async function mobileAssets(
  u: MobileAppPrincipal,
  q?: string | null,
  status?: string | null,
) {
  const a = permit(u, "ACCOUNT_ACCOUNTS");
  await requireAccountModules(a, "ASSETS");
  const rows = await db.asset.findMany({
    where: {
      companyId: a.companyId,
      ...branchScope(a),
      ...(status ? { status: status as AssetStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.filter(
    (x) =>
      !q ||
      x.name.toLowerCase().includes(q.toLowerCase()) ||
      x.assetNumber.toLowerCase().includes(q.toLowerCase()),
  );
}
export async function mobileAssetOptions(u: MobileAppPrincipal) {
  const a = permit(u, "ACCOUNT_ACCOUNTS");
  await requireAccountModules(a, "ASSETS");
  return assetOptionsForActor(a);
}
export async function mobileAssetDetail(u: MobileAppPrincipal, id: string) {
  const a = permit(u, "ACCOUNT_ACCOUNTS");
  await requireAccountModules(a, "ASSETS");
  return getAssetForActor(a, id);
}
export async function mobileSaveAsset(
  u: MobileAppPrincipal,
  raw: unknown,
  id?: string,
) {
  await write(u);
  const a = permit(u, "ACCOUNT_ACCOUNTS");
  await requireAccountModules(a, "ASSETS");
  return id ? updateAssetForActor(a, id, raw) : createAssetForActor(a, raw);
}
export async function mobileAssetAction(
  u: MobileAppPrincipal,
  id: string,
  raw: unknown,
) {
  await write(u);
  const a = permit(u, "ACCOUNT_ACCOUNTS");
  await requireAccountModules(a, "ASSETS");
  const d = raw as {
    action?: string;
    userId?: string;
    notes?: string;
    status?: AssetStatus;
  };
  if (d.action === "ASSIGN" && d.userId)
    return assignAssetForActor(a, id, d.userId, d.notes);
  if (d.action === "RETURN") return returnAssetForActor(a, id, d.notes);
  if (d.action === "STATUS" && d.status)
    return setAssetStatusForActor(a, id, d.status);
  throw new Error("INVALID_INPUT");
}
export async function mobileFinancialYearCreate(
  u: MobileAppPrincipal,
  raw: unknown,
) {
  await write(u);
  const a = permit(u, "ACCOUNT_SETTINGS");
  return createFinancialYearForActor(a, raw);
}
export async function mobileFinancialYearClose(
  u: MobileAppPrincipal,
  raw: unknown,
) {
  await write(u);
  return closeFinancialYearForActor(
    permit(u, "ACCOUNT_PERIOD_LOCK"),
    raw as { financialYearId: string; earlyCloseReason?: string },
  );
}
