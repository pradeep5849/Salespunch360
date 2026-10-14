import {OwnerCorrectionForm} from "@/components/account/owner-correction-form";
import {reportCalendarDate} from "@/lib/account/reports/dates";
import { AccountDate } from "@/components/account/display-preferences";
import { z } from "zod";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AuthorizationError,
  requirePermission,
} from "@/lib/auth/authorization";
import { ownerHistoryForActor } from "@/lib/account/owner-history";
import type { ProjectActor } from "@/lib/account/projects";
import { Money } from "@/components/account/account-ui";
const names: Record<string, string> = {
  INVESTMENT: "Capital addition",
  CAPITAL_WITHDRAWAL: "Capital withdrawal",
  PROFIT_DISTRIBUTION: "Profit distribution",
  WITHDRAWAL: "Legacy withdrawal (unclassified)",
  OWNER_LOAN: "Owner loan received",
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; offset?: string;branchId?:string;scope?:"all" }>;
}) {
  const { id } = await params,
    q = await searchParams,
    actor = (await requirePermission("ACCOUNT_MONEY_VIEW")) as ProjectActor;
  const scopeParams=new URLSearchParams(q.branchId?{branchId:q.branchId}:q.scope==="all"?{scope:q.scope}:{}).toString();
  let data;
  let validationError = false;
  try {
    data = await ownerHistoryForActor(actor, id, {
      branchId:q.branchId,scope:q.scope,
      from: q.from,
      to: q.to,
      offset: q.offset ?? 0,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) notFound();
    if (
      error instanceof z.ZodError ||
      (error instanceof Error && error.message === "INVALID_DATE_RANGE")
    )
      validationError = true;
    else throw error;
  }
  if (validationError || !data)
    return (
      <section className="employees-content">
        <h1>Owner history</h1>
        <p role="alert">Enter valid dates with From before To, or clear the selected scope.</p>
        <Link href={`/workspace/account/money/capital/${id}?${scopeParams}`}>
          Clear dates and retry
        </Link>
      </section>
    );
  const href = (offset: number) =>
    `/workspace/account/money/capital/${id}?${new URLSearchParams({ from: q.from ?? "", to: q.to ?? "", offset: String(offset),...(q.branchId?{branchId:q.branchId}:q.scope==="all"?{scope:q.scope}:{}) })}`;
  return (
    <section className="employees-shell">
      <div className="employees-content owner-history-content">
        <Link href={`/workspace/account/money/capital?${scopeParams}`}>
          Back to Capital &amp; Drawings
        </Link>
        <h1>{data.owner.name}</h1>
        <p>
          {data.owner.partyType === "PARTNER" ? "Partner" : "Owner"} ·{" "}
          {data.owner.isActive ? "Active" : "Inactive"}
        </p>
        {data.owner.phone && <p>{data.owner.phone}</p>}
        {data.owner.email && <p>{data.owner.email}</p>}
        {data.owner.address && <p>{data.owner.address}</p>}
        <h2>Current balances</h2>
        <p>Authorized branches; history date filters do not change these current balances.</p>
        <dl><dt>Capital</dt><dd><Money value={data.currentBalances.capital}/></dd><dt>Profit drawings</dt><dd><Money value={data.currentBalances.drawings}/></dd><dt>Owner loan</dt><dd><Money value={data.currentBalances.loan}/></dd></dl>
        <h2>Transaction history</h2>
        <form method="get" className="stack">
          {q.branchId?<input type="hidden" name="branchId" value={q.branchId}/>:q.scope?<input type="hidden" name="scope" value={q.scope}/>:null}
          <label>
            From
            <input type="date" name="from" defaultValue={q.from} />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={q.to} />
          </label>
          <button>Apply dates</button>
          <Link href={`/workspace/account/money/capital/${id}?${scopeParams}`}>
            Clear dates
          </Link>
        </form>
        <p>
          {data.total} transactions in the selected dates and authorized
          branches.
        </p>
        {!data.items.length && <p>No transactions match these dates.</p>}
        {data.items.map((row) => (
          <article key={row.id}>
            <h3>{names[row.type] ?? row.type}</h3>
            <p>
              <AccountDate value={row.transactionDate} /> ·{" "}
              <Money value={row.amount} /> · {row.moneyAccountName}
            </p>
            {row.reference && <p>Reference: {row.reference}</p>}
            <p>Status: {row.journalStatus}</p>
            {data.canCorrect&&row.journalStatus==="POSTED"&&!row.reversal&&<OwnerCorrectionForm ownerId={id} transactionId={row.id} today={reportCalendarDate()} branchId={q.branchId}/>}
            {row.reversal && (
              <p>
                Reversed <AccountDate value={row.reversal.date} />:{" "}
                {row.reversal.reason}
              </p>
            )}
          </article>
        ))}
        <nav aria-label="Owner history pages">
          {data.offset > 0 && (
            <Link href={href(Math.max(0, data.offset - data.limit))}>
              Previous transactions
            </Link>
          )}{" "}
          {data.hasMore && (
            <Link href={href(data.offset + data.limit)}>Next transactions</Link>
          )}
        </nav>
      </div>
    </section>
  );
}
