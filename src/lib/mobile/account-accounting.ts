import { canUsePermission } from "@/lib/auth/permissions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  accountingOverviewForActor,
  createLedgerAccountForActor,
  postJournalForActor,
  setPeriodLockForActor,
} from "@/lib/accounting/service";
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
export async function mobileAccountingOverview(u: MobileAppPrincipal) {
  return accountingOverviewForActor(permit(u, "ACCOUNT_LEDGER_VIEW"));
}
export async function mobileLedger(u: MobileAppPrincipal, raw: unknown) {
  await assertOperationalWrite(u.companyId);
  return createLedgerAccountForActor(permit(u, "ACCOUNT_CHART_ADMIN"), raw);
}
export async function mobileJournal(u: MobileAppPrincipal, raw: unknown) {
  await assertOperationalWrite(u.companyId);
  return postJournalForActor(permit(u, "ACCOUNT_JOURNAL_POST"), raw);
}
export async function mobilePeriodLock(u: MobileAppPrincipal, raw: unknown) {
  await assertOperationalWrite(u.companyId);
  return setPeriodLockForActor(permit(u, "ACCOUNT_PERIOD_LOCK"), raw);
}
