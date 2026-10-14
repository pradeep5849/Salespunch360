import Link from "next/link";
import { OwnerCapitalSummary } from "../../assets/owner-capital-summary";
import { listMoneyData } from "@/lib/account/money";
import { requirePermission } from "@/lib/auth/authorization";
import { moneyReadContext } from "@/lib/account/money-context";
import { ownerFundingRepaymentOptionsForActor } from "@/lib/account/owner-asset-funding";
import { enabledModulesForCompany } from "@/lib/account/modules";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import {
  isMoneyReadScopeError,
  MoneyReadUnavailable,
} from "@/components/account/money-read-unavailable";
import { OwnerForms } from "./owner-forms";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; scope?: string }>;
}) {
  const query = await searchParams;
  const actor = await requirePermission("ACCOUNT_MONEY_VIEW");
  if (!actor.companyId) return null;
  let context: Awaited<ReturnType<typeof moneyReadContext>>,
    data: Awaited<ReturnType<typeof listMoneyData>>,
    fundingRepayments: Awaited<
      ReturnType<typeof ownerFundingRepaymentOptionsForActor>
    >,
    modules: Awaited<ReturnType<typeof enabledModulesForCompany>>;
  try {
    context = await moneyReadContext(
      { ...actor, companyId: actor.companyId },
      { branchId: query.branchId, scope: query.scope },
    );
    [data, fundingRepayments, modules] = await Promise.all([
      listMoneyData({ branchId: query.branchId, scope: query.scope }),
      ownerFundingRepaymentOptionsForActor(context.actor),
      enabledModulesForCompany(actor.companyId),
    ]);
  } catch (error) {
    if (isMoneyReadScopeError(error)) return <MoneyReadUnavailable />;
    throw error;
  }
  const params = new URLSearchParams(
    context.context.mode === "COMPANY"
      ? { scope: "all" }
      : { branchId: context.context.branchId },
  );
  return (
    <section className="employees-shell">
      <div className="employees-content">
        <WorkspacePageHeader
          title="Capital & Drawings"
          backHref={`/workspace/account/money?${params}`}
        />
        <p>
          Scope:{" "}
          {context.context.mode === "COMPANY"
            ? "All company branches"
            : context.context.branchName}
        </p>
        <OwnerCapitalSummary showLink={false} scopeActor={context.actor} />
        {modules.includes("ASSETS") && (
          <p>
            <Link href={`/workspace/account/money/capital/funding?${params}`}>
              Asset funding
            </Link>
          </p>
        )}
        <OwnerForms
          owners={data.owners}
          users={data.users}
          branches={data.branches}
          accounts={data.dashboard.accounts.map((account) => ({
            id: account.id,
            name: account.name,
            balance: account.balance.toFixed(2),
          }))}
          canManage={data.capabilities.manageOwners}
          canPost={data.capabilities.postOwnerTransactions}
          fundingRepayments={fundingRepayments}
        />
      </div>
    </section>
  );
}
