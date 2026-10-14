import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { moneyReadContext } from "@/lib/account/money-context";
import { ownerAssetFundingOptionsForActor } from "@/lib/account/owner-asset-funding";
import { OwnerAssetFundingForm } from "@/components/account/owner-asset-funding-form";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import {
  isMoneyReadScopeError,
  MoneyReadUnavailable,
} from "@/components/account/money-read-unavailable";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; scope?: string; q?: string }>;
}) {
  const actor = await requirePermission("ACCOUNT_MONEY_VIEW");
  if (!actor.companyId) notFound();
  const query = await searchParams;
  let context: Awaited<ReturnType<typeof moneyReadContext>>,
    options: Awaited<ReturnType<typeof ownerAssetFundingOptionsForActor>>;
  try {
    context = await moneyReadContext(
      { ...actor, companyId: actor.companyId },
      { branchId: query.branchId, scope: query.scope },
    );
    options = await ownerAssetFundingOptionsForActor(context.actor, query.q);
  } catch (error) {
    if (isMoneyReadScopeError(error)) return <MoneyReadUnavailable />;
    if (error instanceof Error && error.message === "MODULE_DISABLED:ASSETS")
      return (
        <section>
          <h1>Asset funding</h1>
          <p>
            Enable Assets to record asset funding. Recorded capital repayments
            remain available in Capital &amp; Drawings.
          </p>
          <Link href="/workspace/account/money/capital">
            Back to Capital &amp; Drawings
          </Link>
        </section>
      );
    throw error;
  }
  const params = new URLSearchParams(
      context.context.mode === "COMPANY"
        ? { scope: "all" }
        : { branchId: context.context.branchId },
    ),
    today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title="Asset funding"
          backHref={`/workspace/account/money/capital?${params}`}
        />
        <p>
          Scope:{" "}
          {context.context.mode === "COMPANY"
            ? "All company branches"
            : context.context.branchName}
        </p>
        <form method="get">
          <input
            type="hidden"
            name={context.context.mode === "COMPANY" ? "scope" : "branchId"}
            value={
              context.context.mode === "COMPANY"
                ? "all"
                : context.context.branchId
            }
          />
          <label>
            Find owner investment
            <input name="q" maxLength={100} defaultValue={query.q} />
          </label>
          <button>Search investments</button>
          <p>Latest 500 matching investments.</p>
        </form>
        <OwnerAssetFundingForm
          options={options}
          canPost={canUsePermission(
            actor,
            "SALESPUNCH360_ACCOUNT",
            "ACCOUNT_MONEY_ENTRY",
          )}
          today={today}
          requestKey={randomUUID()}
          formKeys={Object.fromEntries(
            options.summary.flatMap((row) => [
              [`confirmation:${row.id}`, randomUUID()],
              ...row.fundings.map((funding) => [
                `correction:${funding.id}`,
                randomUUID(),
              ]),
            ]),
          )}
        />
      </section>
    </main>
  );
}
