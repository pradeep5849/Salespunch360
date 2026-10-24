import Link from "next/link";
import {notFound} from "next/navigation";
import {requirePermission,AuthorizationError} from "@/lib/auth/authorization";
import {homeSettlementForActor} from "@/lib/account/home-settlement";
import {AccountDate} from "@/components/account/display-preferences";
import {Money} from "@/components/account/account-ui";
import {AccountPageHeader} from "@/components/account/account-shell";
async function paymentDetails(id:string){
 try{const actor=await requirePermission("ACCOUNT_LEDGER_VIEW");if(!actor.companyId)notFound();const data=await homeSettlementForActor({...actor,companyId:actor.companyId},id);if(!data)notFound();return data;}
 catch(error){if(error instanceof AuthorizationError||(error instanceof Error&&error.message.startsWith("MODULE_DISABLED:")))return null;throw error;}
}
export default async function Page({params}:{params:Promise<{id:string}>}){
 const data=await paymentDetails((await params).id);
 if(!data)return <section className="account-panel" role="status"><h1>Payment access unavailable</h1><p>Your permission or module settings do not allow this payment view.</p><Link href="/workspace/account">Back to Account</Link></section>;
 const entry=data.entry,title=entry.type.startsWith("CUSTOMER")?"Payment-In":"Payment-Out";
 return <><AccountPageHeader title={title} subtitle={`${entry.documentNumber} · ${data.branch}`}/><section className="account-panel" aria-label="Payment details"><Link href="/workspace/account">Back to Home</Link><dl><dt>Party</dt><dd>{entry.partyName}</dd><dt>Date</dt><dd><AccountDate value={entry.issueDate.toISOString()}/></dd><dt>Status</dt><dd>{entry.status}</dd><dt>Type</dt><dd>{entry.type.replaceAll("_"," ")}</dd><dt>Payment mode</dt><dd>{data.paymentMode}</dd><dt>Amount</dt><dd><Money value={entry.grandTotal}/></dd><dt>Payment discount</dt><dd><Money value={data.discountAmount}/></dd><dt>Unallocated amount</dt><dd><Money value={entry.balanceDue}/></dd>{data.reference&&<><dt>Reference</dt><dd>{data.reference}</dd></>}</dl><h2>Applications</h2>{data.applications.length?<div className="account-table-wrap"><table><thead><tr><th>Applied to</th><th>Status</th><th>Applied amount</th><th>Discount</th></tr></thead><tbody>{data.applications.map(row=><tr key={row.id}><td>{row.href?<Link href={row.href}>{row.number}</Link>:row.number}</td><td>{row.status}</td><td><Money value={row.amount}/></td><td><Money value={row.discount}/></td></tr>)}</tbody></table></div>:<p>No applications.</p>}{data.notes&&<p style={{whiteSpace:"pre-wrap"}}>{data.notes}</p>}<Link href={`/api/account/print/${entry.printType}/${entry.id}?format=pdf`}>Download PDF</Link></section></>;
}
