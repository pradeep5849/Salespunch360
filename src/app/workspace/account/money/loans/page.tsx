import Link from "next/link";
import { ClientMoney } from "@/components/account/display-preferences";
import { requirePermission } from "@/lib/auth/authorization";
import { loanOverviewForActor } from "@/lib/account/loan-overview";
import {LoanForms} from "@/components/account/loan-forms";
import { listMoneyData } from "@/lib/account/money";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
export default async function Page({searchParams}:{searchParams:Promise<{branchId?:string;scope?:string;q?:string;status?:string;archived?:string;offset?:string}>}) {
  const query=await searchParams;
  const actor=await requirePermission("ACCOUNT_MONEY_VIEW");
  const overview=await loanOverviewForActor({...actor,companyId:actor.companyId!},query);
  const d = await listMoneyData(overview.branchContext.mode==="BRANCH"?{branchId:overview.branchContext.branchId}:{scope:"all"});
  const scopeQuery=overview.branchContext.mode==="BRANCH"?`branchId=${overview.branchContext.branchId}`:"scope=all";
  const pageHref=(offset:number)=>`/workspace/account/money/loans?${new URLSearchParams({...query,...Object.fromEntries(new URLSearchParams(scopeQuery)),offset:String(offset)})}`;
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title="Loans & EMI"
          backHref="/workspace/account/money"
        />
        <section aria-label="Loan balances">
          <h2>Loans</h2>
          <p>Scope: {overview.branchContext.mode==="BRANCH"?overview.branchContext.branchName:"Company consolidated"}</p>
          <p>{overview.total} matching loans · Effective posted outstanding: <ClientMoney value={overview.outstanding} /></p>
          {overview.unpostedBalanceCount>0&&<p role="status">{overview.unpostedBalanceCount} loan records have no established individual liability balance. Unposted or shared legacy balances must be resolved before they can be included.</p>}
          <form method="get" className="stack">
            {overview.branchContext.mode==="BRANCH"?<input type="hidden" name="branchId" value={overview.branchContext.branchId}/>:<input type="hidden" name="scope" value="all"/>}
            <label>Search loans<input name="q" defaultValue={query.q??""} maxLength={160}/></label>
            <label>Status<select name="status" defaultValue={query.status??""}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="PAID_OFF">Paid off</option><option value="CANCELLED">Cancelled</option></select></label>
            <label>Archive status<select name="archived" defaultValue={query.archived??""}><option value="">All loan records</option><option value="active">Not archived</option><option value="archived">Archived</option></select></label>
            <button>Apply loan filters</button>
          </form>
          {!overview.rows.length?<section className="account-panel" aria-label="Loan empty state" style={{textAlign:"center",padding:24}}><svg aria-hidden="true" width="72" height="72" viewBox="0 0 72 72"><path d="M10 26 36 10 62 26M16 30h40M12 60h48M22 32v22m14-22v22m14-22v22" fill="none" stroke="#1685AD" strokeWidth="4"/></svg><h3>{query.q||query.status||query.archived?"No loans match these filters":overview.total>0?"No loans on this page":"No loans yet"}</h3><p>{query.q||query.status||query.archived?"Clear the filters to see the loans available in this scope.":"Add a loan to track its outstanding balance, repayments and statement."}</p>{query.q||query.status||query.archived||overview.offset>0?<Link style={{display:"inline-flex",alignItems:"center",minHeight:44}} href={`/workspace/account/money/loans?${scopeQuery}`}>Clear loan filters</Link>:d.capabilities.manageLoans&&<a style={{display:"inline-flex",alignItems:"center",minHeight:44}} href="#loan-entry">Add Loan</a>}</section>:<div className="table-wrap" role="region" aria-label="Loan balances table" tabIndex={0}><table><thead><tr><th>Lender / loan</th><th>Original principal</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{overview.rows.map(loan=><tr key={loan.id}><td><Link href={`/workspace/account/money/loans/${loan.id}?${scopeQuery}`}>{loan.displayName||loan.lender} · {loan.loanType}</Link></td><td><ClientMoney value={loan.principal.toString()}/></td><td>{loan.outstanding===null?"Not established":<ClientMoney value={loan.outstanding}/>}</td><td>{loan.status.replaceAll("_"," ")}{loan.archivedAt?" · Archived":""}</td></tr>)}</tbody></table></div>}
          <nav aria-label="Loan list pages">{overview.offset>0&&<Link href={pageHref(Math.max(0,overview.offset-overview.limit))}>Previous loans</Link>} {overview.nextOffset!==null&&<Link href={pageHref(overview.nextOffset)}>Next loans</Link>}</nav>
        </section>
        {d.capabilities.manageLoans&&<section id="loan-entry" aria-label="Loan entry" tabIndex={-1}><LoanForms key={overview.branchContext.mode==="BRANCH"?overview.branchContext.branchId:"all"} branches={d.branches.map(x=>({id:x.id,name:x.name}))} accounts={d.dashboard.accounts.map(x=>({id:x.id,name:x.name,branchId:x.branchId,isActive:x.isActive}))} loans={d.loans.map(x=>({id:x.id,lender:x.lender,displayName:x.displayName,branchId:x.branchId,status:x.status,archived:!!x.archivedAt}))} initialBranch={overview.branchContext.mode==="BRANCH"?overview.branchContext.branchId:undefined} creationKey={crypto.randomUUID()} paymentKey={crypto.randomUUID()}/></section>}

      </section>
    </div>
  );
}
