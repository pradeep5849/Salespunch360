import {MoneyAccountMetadataForm} from "@/components/account/money-account-form";
import { randomUUID } from "node:crypto";
import { canUsePermission } from "@/lib/auth/permissions";
import { moneyAdjustmentOptionsForActor } from "@/lib/account/money-adjustment";
import { MoneyAdjustmentForm } from "@/components/account/money-adjustment-form";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/authorization";
import { moneyAccountHistoryForActor } from "@/lib/account/money-account-history";
import type { ProjectActor } from "@/lib/account/projects";
import {
  AccountDate,
  ClientMoney,
} from "@/components/account/display-preferences";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import {
  isMoneyReadScopeError,
  MoneyReadUnavailable,
} from "@/components/account/money-read-unavailable";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const actor = await requirePermission("ACCOUNT_MONEY_VIEW");
  const { id } = await params;
  const query = await searchParams;
  let data;
  try {
    data = await moneyAccountHistoryForActor(
      { ...actor, companyId: actor.companyId! } as ProjectActor,
      id,
      query,
    );
  } catch (e) {
    if (isMoneyReadScopeError(e)) return <MoneyReadUnavailable />;
    throw e;
  }
  const adjustmentOptions =
    data.account.isActive &&
    canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_ENTRY")
      ? await moneyAdjustmentOptionsForActor({
          ...actor,
          companyId: actor.companyId!,
        } as ProjectActor)
      : null;
  const scope: Record<string, string> =
    data.branchContext.mode === "COMPANY"
      ? { scope: "all" }
      : { branchId: data.branchContext.branchId };
  const href = (offset: number) =>
    `?${new URLSearchParams({ ...scope, ...(data.from ? { from: data.from } : {}), ...(data.to ? { to: data.to } : {}), offset: String(offset) })}`;
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title={data.account.name}
          backHref={`/workspace/account/money/${data.account.type === "BANK" ? "bank-accounts" : "cash-in-hand"}?${new URLSearchParams(scope)}`}
        />
        <p>
          {data.account.type}
          {!data.account.isActive ? " · Inactive" : ""} · Scope:{" "}
          {data.branchContext.mode === "COMPANY"
            ? "All company branches"
            : data.branchContext.branchName}
        </p>
        {canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_MONEY_ENTRY")&&<MoneyAccountMetadataForm account={data.account}/>}
        <form method="get">
          <input
            type="hidden"
            name={data.branchContext.mode === "COMPANY" ? "scope" : "branchId"}
            value={Object.values(scope)[0]}
          />
          <label>
            From
            <input name="from" type="date" defaultValue={data.from ?? ""} />
          </label>
          <label>
            To
            <input name="to" type="date" defaultValue={data.to ?? ""} />
          </label>
          <button type="submit">Apply dates</button>
        </form>
        <dl>
          <dt>Opening balance</dt>
          <dd>
            <ClientMoney value={data.opening} />
          </dd>
          <dt>Money in</dt>
          <dd>
            <ClientMoney value={data.debit} />
          </dd>
          <dt>Money out</dt>
          <dd>
            <ClientMoney value={data.credit} />
          </dd>
          <dt>Closing balance</dt>
          <dd>
            <ClientMoney value={data.closing} />
          </dd>
        </dl>
        {data.rows.length ? (
          <div
            style={{ overflowX: "auto" }}
            tabIndex={0}
            role="region"
            aria-label="Scrollable account history"
          >
            <table>
              <caption>Account ledger history</caption>
              <thead>
                <tr>
                  {[
                    "Date",
                    "Journal",
                    "Description",
                    "Money in",
                    "Money out",
                    "Balance",
                  ].map((s) => (
                    <th key={s} scope="col">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <AccountDate
                        value={r.entryDate.toISOString().slice(0, 10)}
                      />
                    </td>
                    <td>
                      {r.journalNumber}
                      {r.status === "REVERSED" ? " · Reversed" : ""}
                    </td>
                    <td>
                      {r.narration ??
                        r.reference ??
                        r.sourceType.replaceAll("_", " ")}
                    </td>
                    <td>
                      <ClientMoney value={r.debit} />
                    </td>
                    <td>
                      <ClientMoney value={r.credit} />
                    </td>
                    <td>
                      <ClientMoney value={r.balance} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No posted entries match these dates.</p>
        )}
        {adjustmentOptions && (
          <MoneyAdjustmentForm
            accountId={id}
            branches={adjustmentOptions.branches.filter(
              (b) => !data.account.branchId || b.id === data.account.branchId,
            )}
            ledgers={adjustmentOptions.ledgers}
            selectedBranch={
              data.branchContext.mode === "BRANCH"
                ? data.branchContext.branchId
                : undefined
            }
            requestKey={randomUUID()}
          />
        )}
        <nav aria-label="Account history pages">
          {data.offset > 0 && (
            <Link href={href(Math.max(0, data.offset - data.limit))}>
              Previous
            </Link>
          )}{" "}
          {data.offset + data.limit < data.total && (
            <Link href={href(data.offset + data.limit)}>Next</Link>
          )}
        </nav>
      </section>
    </div>
  );
}
