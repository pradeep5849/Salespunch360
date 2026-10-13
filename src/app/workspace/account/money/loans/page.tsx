import Link from "next/link";
import { ClientMoney } from "@/components/account/display-preferences";
import { requirePermission } from "@/lib/auth/authorization";
import { loanOverviewForActor } from "@/lib/account/loan-overview";
import { loanAction, loanPaymentAction } from "@/app/actions/money";
import { listMoneyData } from "@/lib/account/money";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
export default async function Page({searchParams}:{searchParams:Promise<{branchId?:string;scope?:string;q?:string;status?:string;offset?:string}>}) {
  const query=await searchParams;
  const actor=await requirePermission("ACCOUNT_MONEY_VIEW");
  const overview=await loanOverviewForActor({...actor,companyId:actor.companyId!},query);
  const d = await listMoneyData();
  const scopeQuery=overview.branchContext.mode==="BRANCH"?`branchId=${overview.branchContext.branchId}`:"scope=all";
  const pageHref=(offset:number)=>`/workspace/account/money/loans?${new URLSearchParams({...query,...Object.fromEntries(new URLSearchParams(scopeQuery)),offset:String(offset)})}`;
  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title="Loans & EMI"
          backHref="/workspace/account/money"
        />
        <section aria-label="Loan balances">
          <h2>Loans</h2>
          <p>Scope: {overview.branchContext.mode==="BRANCH"?overview.branchContext.branchName:"Company consolidated"}</p>
          <p>{overview.total} matching loans · Effective posted outstanding: <ClientMoney value={overview.outstanding} /></p>
          {overview.unpostedBalanceCount>0&&<p role="status">{overview.unpostedBalanceCount} loan records have no posted liability balance. Their starting balance must be established before it can be included.</p>}
          <form method="get" className="stack">
            {overview.branchContext.mode==="BRANCH"?<input type="hidden" name="branchId" value={overview.branchContext.branchId}/>:<input type="hidden" name="scope" value="all"/>}
            <label>Search loans<input name="q" defaultValue={query.q??""} maxLength={160}/></label>
            <label>Status<select name="status" defaultValue={query.status??""}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="PAID_OFF">Paid off</option><option value="CANCELLED">Cancelled</option></select></label>
            <button>Apply loan filters</button>
          </form>
          {!overview.rows.length?<p role="status">No loans match these filters.</p>:<div className="table-wrap" role="region" aria-label="Loan balances table" tabIndex={0}><table><thead><tr><th>Lender / loan</th><th>Original principal</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{overview.rows.map(loan=><tr key={loan.id}><td><Link href={`/workspace/account/money/loans/${loan.id}?${scopeQuery}`}>{loan.displayName||loan.lender} · {loan.loanType}</Link></td><td><ClientMoney value={loan.principal.toString()}/></td><td>{loan.outstanding===null?"Not established":<ClientMoney value={loan.outstanding}/>}</td><td>{loan.status.replaceAll("_"," ")}</td></tr>)}</tbody></table></div>}
          <nav aria-label="Loan list pages">{overview.offset>0&&<Link href={pageHref(Math.max(0,overview.offset-overview.limit))}>Previous loans</Link>} {overview.nextOffset!==null&&<Link href={pageHref(overview.nextOffset)}>Next loans</Link>}</nav>
        </section>
        <form action={loanAction} className="stack">
          <select name="branchId">
            {d.branches.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select name="moneyAccountId">
            {d.dashboard.accounts.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <label>Loan name<input name="displayName" maxLength={240}/></label>
          <label>Loan account number<input name="loanAccountNumber" maxLength={160}/></label>
          <label>Description<textarea name="description" maxLength={2000}/></label>
          <label>Duration (months)<input name="durationMonths" type="number" min={1} max={1200}/></label>
          <label>Lender<input name="lender" required maxLength={240}/></label>
          <input name="loanType" placeholder="Loan type" required />
          <input name="principal" required />
          <input name="interestRate" />
          <input type="date" name="startDate" required />
          <input type="date" name="maturityDate" />
          <input name="reference" />
          <input
            type="hidden"
            name="idempotencyKey"
            value={crypto.randomUUID()}
          />
          <button>Create and receive loan</button>
        </form>
        <h2>Payments</h2>
        <form action={loanPaymentAction} className="stack">
          <select name="loanId">
            {d.loans
              .filter((x) => x.status === "ACTIVE")
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.lender}
                </option>
              ))}
          </select>
          <select name="moneyAccountId">
            {d.dashboard.accounts.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <input type="date" name="paymentDate" required />
          <input name="principal" placeholder="Principal" required />
          <input name="interest" placeholder="Interest" required />
          <input name="charges" defaultValue="0" />
          <input
            type="hidden"
            name="idempotencyKey"
            value={crypto.randomUUID()}
          />
          <button>Post EMI/payment</button>
        </form>
      </section>
    </main>
  );
}
