import Image from "next/image";
import Link from "next/link";
import {DownloadExcel,reportQueryWasRun} from "@/components/workspace/download-excel";
import { checkInReport } from "@/lib/reports/check-ins";
import { reportActor } from "@/lib/reports/scope";
import type { SearchParams } from "@/lib/reports/validation";
import { dateTime,distance,duration,Filters,Summary } from "../report-ui";
import styles from "../sales-report-cards.module.css";

const one=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageHref=(raw:SearchParams,page:number)=>{const q=new URLSearchParams();for(const[key,value]of Object.entries(raw)){const v=Array.isArray(value)?value[0]:value;if(v&&key!=="page")q.set(key,v)}q.set("page",String(page));return`?${q.toString()}`};

export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}){
 const raw=await searchParams;
 const actor=await reportActor();
 const selectedDate=one(raw.date)||"";
 const effectiveRaw=actor.salesRole==="SALES"&&selectedDate?{...raw,start:selectedDate,end:selectedDate}:raw;
 const r=await checkInReport(effectiveRaw,false,actor);
 if(actor.salesRole==="SALES")return <SalesCheckInReport r={r} selectedDate={selectedDate}/>;
 return <main className={styles.salesPage}>
  <header className={styles.heading}><h1>Check-in Report</h1><p>Recent check-ins from all authorized users are shown by default. Select an employee and date range when you need a specific report.</p></header>
  <section className={styles.searchCard}>
   <DownloadExcel report="check-ins" params={raw} ready={reportQueryWasRun(raw)}/>
   <Filters filters={r.filters} employees={r.employees}>
    <label>Customer<select name="customerId" defaultValue={r.customerId||""}><option value="">All Customers</option>{r.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Status<select name="status" defaultValue={r.status}><option value="ALL">All</option><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option></select></label>
    <label>Sentiment<select name="sentiment" defaultValue={r.sentiment}><option value="ALL">All</option><option value="POSITIVE">Positive</option><option value="NEUTRAL">Neutral</option><option value="NEGATIVE">Negative</option></select></label>
   </Filters>
  </section>
  <Summary items={[{label:'Total check-ins',value:r.summary.total},{label:'Completed',value:r.summary.completed},{label:'Active',value:r.summary.pending},{label:'Leads generated',value:r.summary.leadsGenerated}]}/>
  <CheckInCards rows={r.rows} showEmployee/>
  {r.totalPages>1&&<nav className={styles.pager} aria-label="Check-in report pages">{r.filters.page>1&&<Link href={pageHref(raw,r.filters.page-1)}>Previous</Link>}<span>Page {r.filters.page} of {r.totalPages}</span>{r.filters.page<r.totalPages&&<Link href={pageHref(raw,r.filters.page+1)}>Next</Link>}</nav>}
 </main>
}

type CheckInResult=Awaited<ReturnType<typeof checkInReport>>;
function CheckInCards({rows,showEmployee=false}:{rows:CheckInResult['rows'];showEmployee?:boolean}){
 if(!rows.length)return <div className={styles.empty}>No check-ins found for the selected filters.</div>;
 return <section className={styles.cards}>{rows.map(v=><article className={styles.checkinCard} key={v.id}>
  {v.photo&&<Image className={styles.checkinPhoto} src={`/api/visit-photos/${v.id}/thumbnail`} alt="Check-in photo" width={900} height={560} unoptimized/>}
  <div className={styles.checkinBody}>
   <div className={styles.checkinTop}><h2>{v.leadId?<Link href={`/workspace/leads/${v.leadId}`}>{v.customer?.name||v.contactName||"Customer"}</Link>:v.customer?.name||v.contactName||"Customer"}</h2><span className={styles.timePill}>{v.checkedOutAt?"Completed":"Active"}</span></div>
   {showEmployee&&<p className={styles.meta}><strong>{v.user.name}</strong> · {v.user.salesRole}</p>}
   <p className={styles.meta}>{dateTime(v.checkedInAt)}{v.checkedOutAt?` · Checkout ${dateTime(v.checkedOutAt)}`:""}</p>
   <p className={styles.address}>{v.checkInAddress||`${v.checkInLatitude.toFixed(5)}, ${v.checkInLongitude.toFixed(5)}`}</p>
   {(v.checkoutSentiment||v.checkoutRemarks||v.visitNotes)&&<p className={styles.meta}>{[v.checkoutSentiment,v.checkoutRemarks,v.visitNotes].filter(Boolean).join(" · ")}</p>}
   {v.leadId&&<p><Link href={`/workspace/leads/${v.leadId}`}>Open Lead Details</Link></p>}
  </div>
 </article>)}</section>;
}

function SalesCheckInReport({r,selectedDate}:{r:CheckInResult;selectedDate:string}){
 const page=r.filters.page;
 const salesPageHref=(next:number)=>selectedDate?`?date=${encodeURIComponent(selectedDate)}&page=${next}`:`?page=${next}`;
 return <main className={styles.salesPage}>
  <header className={styles.heading}><h1>Check-in Report</h1><p>All your check-ins, latest first. Search any particular day using the date below.</p></header>
  <form className={styles.searchCard}>
   <div className={styles.searchRow}>
    <label>Search check-ins by date<input type="date" name="date" defaultValue={selectedDate}/></label>
    <button className={styles.primary}>Search</button>
    <Link className={styles.secondary} href="?">Clear</Link>
   </div>
  </form>
  <CheckInCards rows={r.rows}/>
  {r.totalPages>1&&<nav className={styles.pager} aria-label="Check-in report pages">{page>1&&<Link href={salesPageHref(page-1)}>Previous</Link>}<span>Page {page} of {r.totalPages}</span>{page<r.totalPages&&<Link href={salesPageHref(page+1)}>Next</Link>}</nav>}
 </main>
}

export function VisitTable({rows}:{rows:CheckInResult['rows']}){if(!rows.length)return <div className="empty-state">No check-ins match the selected filters and date range.</div>;return <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Employee / customer</th><th>Check-in / checkout</th><th>Status / duration</th><th>Visit details</th><th>Check-in address / coordinates</th><th>Leads</th></tr></thead><tbody>{rows.map(v=><tr key={v.id}><td><strong>{v.user.name}</strong><small>{v.user.salesRole} · {v.leadId?<Link href={`/workspace/leads/${v.leadId}`}>{v.customer?.name||v.contactName||"Customer"}</Link>:v.customer?.name||v.contactName||"Customer"}</small></td><td>{dateTime(v.checkedInAt)}<small>{dateTime(v.checkedOutAt)}</small></td><td>{v.checkedOutAt?'COMPLETED':'ACTIVE'}<small>{duration(v.durationMs)}</small></td><td>{v.visitNotes||'—'}<small>{v.visitKind?`${v.visitKind} · `:''}{v.checkoutSentiment||'No sentiment'} · {v.checkoutRemarks||'No remarks'}</small></td><td>{v.checkInAddress||`${v.checkInLatitude.toFixed(5)}, ${v.checkInLongitude.toFixed(5)}`}<small>{v.checkOutLatitude?.toFixed(5)||'—'}, {v.checkOutLongitude?.toFixed(5)||'—'} · Ref. {distance(v.referenceDistanceMeters)}</small></td><td>{v.leadId?<Link href={`/workspace/leads/${v.leadId}`}>Open lead</Link>:v._count.sourceLeads}</td></tr>)}</tbody></table></div>}
