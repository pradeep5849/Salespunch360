import Link from "next/link";
import {requirePermission} from "@/lib/auth/authorization";
import {loanHistoryForActor} from "@/lib/account/loan-history";
import {AccountDate,ClientMoney} from "@/components/account/display-preferences";
import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
export default async function LoanDetail({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{branchId?:string;scope?:string;offset?:string}>}){
 const [{id},query]=await Promise.all([params,searchParams]);const actor=await requirePermission("ACCOUNT_MONEY_VIEW");
 const data=await loanHistoryForActor({...actor,companyId:actor.companyId!},id,query);
 const scope:Record<string,string>=data.branchContext.mode==="BRANCH"?{branchId:data.branchContext.branchId}:{scope:"all"};
 const href=(offset:number)=>`/workspace/account/money/loans/${id}?${new URLSearchParams({...scope,offset:String(offset)})}`;
 return <section className="employees-content"><WorkspacePageHeader title={data.loan.displayName||data.loan.lender} backHref={`/workspace/account/money/loans?${new URLSearchParams(scope)}`}/>
 <dl><dt>Lender</dt><dd>{data.loan.lender}</dd><dt>Account number</dt><dd>{data.loan.loanAccountNumber||"Not provided"}</dd><dt>Description</dt><dd>{data.loan.description||"Not provided"}</dd><dt>Duration (months)</dt><dd>{data.loan.durationMonths??"Not provided"}</dd><dt>Loan type</dt><dd>{data.loan.loanType}</dd><dt>Original principal</dt><dd><ClientMoney value={data.loan.principal.toString()}/></dd><dt>Outstanding principal</dt><dd>{data.outstanding===null?"Starting liability balance not established":<ClientMoney value={data.outstanding}/>}</dd><dt>Start date</dt><dd><AccountDate value={data.loan.startDate.toISOString().slice(0,10)}/></dd><dt>Status</dt><dd>{data.loan.status.replaceAll("_"," ")}</dd></dl>
 <h2>Loan statement</h2><p>{data.total} posted entries. Reversal entries are included in the running balance.</p>
 {!data.rows.length?<p role="status">No posted loan transactions.</p>:<div className="table-wrap" role="region" aria-label="Loan statement" tabIndex={0}><table><thead><tr><th>Date</th><th>Transaction</th><th>Principal increase</th><th>Principal decrease</th><th>Payment total</th><th>Ending principal</th></tr></thead><tbody>{data.rows.map(row=><tr key={row.id}><td><AccountDate value={row.entryDate.toISOString().slice(0,10)}/></td><td>{row.sourceType.replaceAll("_"," ")} · {row.journalNumber} · {row.status}</td><td><ClientMoney value={row.credit}/></td><td><ClientMoney value={row.debit}/></td><td>{row.payment===null?"—":<ClientMoney value={row.payment}/>}</td><td><ClientMoney value={row.balance}/></td></tr>)}</tbody></table></div>}
 <nav aria-label="Loan statement pages">{data.offset>0&&<Link href={href(Math.max(0,data.offset-data.limit))}>Previous entries</Link>} {data.nextOffset!==null&&<Link href={href(data.nextOffset)}>Next entries</Link>}</nav>
 </section>;
}
