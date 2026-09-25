import Image from "next/image";
import Link from "next/link";
import {DownloadExcel,reportQueryWasRun} from "@/components/workspace/download-excel";
import { checkInReport } from "@/lib/reports/check-ins";
import { reportActor } from "@/lib/reports/scope";
import type { SearchParams } from "@/lib/reports/validation";
import { dateTime,distance,duration,Filters,Pagination,ReportHeader,Summary } from "../report-ui";
import styles from "../sales-report-cards.module.css";

const one=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}){
 const raw=await searchParams;
 const actor=await reportActor();
 const selectedDate=one(raw.date)||"";
 const effectiveRaw=actor.salesRole==="SALES"&&selectedDate?{...raw,start:selectedDate,end:selectedDate}:raw;
 const r=await checkInReport(effectiveRaw,false,actor);
 if(actor.salesRole==="SALES")return <SalesCheckInReport r={r} selectedDate={selectedDate}/>;
 return <main className="reports-content"><ReportHeader title="Check-in Report" description="Check-in details by date, employee, status and sentiment."/><DownloadExcel report="check-ins" params={raw} ready={reportQueryWasRun(raw)}/><Filters filters={r.filters} employees={r.employees} showEmployee={r.actor.salesRole!=="SALES"}><label>Customer<select name="customerId" defaultValue={r.customerId||""}><option value="">All Customers</option>{r.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Status<select name="status" defaultValue={r.status}><option value="ALL">All</option><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option></select></label><label>Sentiment<select name="sentiment" defaultValue={r.sentiment}><option value="ALL">All</option><option value="POSITIVE">Positive</option><option value="NEUTRAL">Neutral</option><option value="NEGATIVE">Negative</option></select></label></Filters><Summary items={[{label:'Total check-ins',value:r.summary.total},{label:'Completed',value:r.summary.completed},{label:'Active',value:r.summary.pending},{label:'Leads generated',value:r.summary.leadsGenerated}]}/><VisitTable rows={r.rows}/><Pagination page={r.filters.page} totalPages={r.totalPages}/></main>
}

type CheckInResult=Awaited<ReturnType<typeof checkInReport>>;
function SalesCheckInReport({r,selectedDate}:{r:CheckInResult;selectedDate:string}){
 const page=r.filters.page;
 const pageHref=(next:number)=>selectedDate?`?date=${encodeURIComponent(selectedDate)}&page=${next}`:`?page=${next}`;
 return <main className={styles.salesPage}>
  <header className={styles.heading}><h1>Check-in Report</h1><p>All your check-ins, latest first. Search any particular day using the date below.</p></header>
  <form className={styles.searchCard}>
   <div className={styles.searchRow}>
    <label>Search check-ins by date<input type="date" name="date" defaultValue={selectedDate}/></label>
    <button className={styles.primary}>Search</button>
    <Link className={styles.secondary} href="?">Clear</Link>
   </div>
  </form>
  {!r.rows.length?<div className={styles.empty}>No check-ins found{selectedDate?" for this date":""}.</div>:<section className={styles.cards}>{r.rows.map(v=><article className={styles.checkinCard} key={v.id}>
   {v.photo&&<Image className={styles.checkinPhoto} src={`/api/visit-photos/${v.id}/thumbnail`} alt="Check-in photo" width={900} height={560} unoptimized/>}
   <div className={styles.checkinBody}>
    <div className={styles.checkinTop}><h2>{v.customer?.name||v.contactName||"Field prospect"}</h2><span className={styles.timePill}>{v.checkedOutAt?"Completed":"Active"}</span></div>
    <p className={styles.meta}>{dateTime(v.checkedInAt)}</p>
    <p className={styles.address}>{v.checkInAddress||`${v.checkInLatitude.toFixed(5)}, ${v.checkInLongitude.toFixed(5)}`}</p>
   </div>
  </article>)}</section>}
  {r.totalPages>1&&<nav className={styles.pager} aria-label="Check-in report pages">{page>1&&<Link href={pageHref(page-1)}>Previous</Link>}<span>Page {page} of {r.totalPages}</span>{page<r.totalPages&&<Link href={pageHref(page+1)}>Next</Link>}</nav>}
 </main>
}

export function VisitTable({rows}:{rows:CheckInResult['rows']}){if(!rows.length)return <div className="empty-state">No check-ins match the selected filters and date range.</div>;return <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Employee / customer</th><th>Check-in / checkout</th><th>Status / duration</th><th>Visit details</th><th>Check-in address / coordinates</th><th>Leads</th></tr></thead><tbody>{rows.map(v=><tr key={v.id}><td><strong>{v.user.name}</strong><small>{v.user.salesRole} · {v.customer?.name||v.contactName||"Field prospect"}</small></td><td>{dateTime(v.checkedInAt)}<small>{dateTime(v.checkedOutAt)}</small></td><td>{v.checkedOutAt?'COMPLETED':'ACTIVE'}<small>{duration(v.durationMs)}</small></td><td>{v.visitNotes||'—'}<small>{v.visitKind?`${v.visitKind} · `:''}{v.checkoutSentiment||'No sentiment'} · {v.checkoutRemarks||'No remarks'}</small></td><td>{v.checkInAddress||`${v.checkInLatitude.toFixed(5)}, ${v.checkInLongitude.toFixed(5)}`}<small>{v.checkOutLatitude?.toFixed(5)||'—'}, {v.checkOutLongitude?.toFixed(5)||'—'} · Ref. {distance(v.referenceDistanceMeters)}</small></td><td>{v._count.sourceLeads}</td></tr>)}</tbody></table></div>}
