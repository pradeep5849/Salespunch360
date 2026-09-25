import {DownloadExcel,reportQueryWasRun} from "@/components/workspace/download-excel";
import { attendanceReport } from "@/lib/reports/attendance";
import type { SearchParams } from "@/lib/reports/validation";
import { dateTime,distance,duration,Filters,Pagination,ReportHeader,Summary } from "../report-ui";
import styles from "../sales-report-cards.module.css";

const INDIA_TIME_ZONE="Asia/Kolkata";
const dateKey=(date:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:INDIA_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const timeOnly=(date:Date|null)=>date?new Intl.DateTimeFormat("en-IN",{timeZone:INDIA_TIME_ZONE,hour:"numeric",minute:"2-digit"}).format(date):"Now";
const dayLabel=(key:string)=>new Intl.DateTimeFormat("en-IN",{timeZone:INDIA_TIME_ZONE,day:"numeric",month:"short",year:"numeric"}).format(new Date(`${key}T12:00:00+05:30`));
const workDuration=(ms:number)=>`${Math.floor(ms/3600000)}h ${Math.floor((ms%3600000)/60000)}m`;

export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}){
 const raw=await searchParams,r=await attendanceReport(raw);
 if(r.actor.salesRole==="SALES")return <SalesAttendanceReport r={r}/>;
 return <main className="reports-content"><ReportHeader title="Attendance Report" description="Completed totals exclude open sessions; open rows remain clearly identified."/><DownloadExcel report="attendance" params={raw} ready={reportQueryWasRun(raw)}/><Filters filters={r.filters} employees={r.employees}><label>Status<select name="status" defaultValue={r.status}><option>ALL</option><option>COMPLETED</option><option>OPEN</option></select></label></Filters><Summary items={[{label:'Sessions',value:r.summary.total},{label:'Completed',value:r.summary.completed},{label:'Open',value:r.summary.open},{label:'Completed work',value:duration(r.summary.totalDurationMs)},{label:'Average completed',value:r.summary.completed?duration(r.summary.averageDurationMs):'—'}]}/>{!r.rows.length?<div className="empty-state">No attendance sessions match the selected filters.</div>:<div className="report-table-wrap"><table className="report-table"><thead><tr><th>Employee</th><th>Start / end</th><th>Status / duration</th><th>Start / end GPS</th><th>Route</th></tr></thead><tbody>{r.rows.map(a=><tr key={a.id}><td><strong>{a.user.name}</strong><small>{a.user.salesRole}</small></td><td>{dateTime(a.startedAt)}<small>{dateTime(a.endedAt)}</small></td><td>{a.endedAt?'COMPLETED':'OPEN'}<small>{duration(a.durationMs)}</small></td><td>{a.startLatitude?.toFixed(5)||'—'}, {a.startLongitude?.toFixed(5)||'—'}<small>{a.endLatitude?.toFixed(5)||'—'}, {a.endLongitude?.toFixed(5)||'—'}</small></td><td>{a.locationPoints.length} points<small>{distance(a.routeDistanceMeters)}</small></td></tr>)}</tbody></table></div>}<Pagination page={r.filters.page} totalPages={r.totalPages}/></main>
}

type AttendanceResult=Awaited<ReturnType<typeof attendanceReport>>;
type AttendanceRow=AttendanceResult['rows'][number];
const sessionDurationMs=(row:AttendanceRow)=>Math.max(0,(row.endedAt?.getTime()??Date.now())-row.startedAt.getTime());

function SessionCard({row}:{row:AttendanceRow}){
 return <article className={styles.sessionCard}><div className={styles.sessionTimes}><div><small>Start Time</small><strong>{timeOnly(row.startedAt)}</strong></div><span className={styles.sessionDuration}>{workDuration(sessionDurationMs(row))}</span><div><small>End Time</small><strong className={row.endedAt?styles.completedTag:styles.openTag}>{timeOnly(row.endedAt)}</strong></div></div></article>
}

function DayStats({rows}:{rows:AttendanceRow[]}){
 const ordered=[...rows].sort((a,b)=>a.startedAt.getTime()-b.startedAt.getTime());
 const first=ordered[0];
 const last=ordered.reduce((latest,row)=>!latest.endedAt||!row.endedAt?row:(row.endedAt.getTime()>latest.endedAt.getTime()?row:latest),ordered[0]);
 const total=ordered.reduce((sum,row)=>sum+sessionDurationMs(row),0);
 return <div className={styles.dayStats}><div><small>Start Time</small><strong>{timeOnly(first.startedAt)}</strong></div><div><small>End Time</small><strong>{last.endedAt?timeOnly(last.endedAt):"Now"}</strong></div><div><small>Total Duration</small><strong>{workDuration(total)}</strong></div></div>
}

function SalesAttendanceReport({r}:{r:AttendanceResult}){
 const today=dateKey(new Date());
 const groups=new Map<string,AttendanceRow[]>();
 for(const row of r.rows){const key=dateKey(row.startedAt);const items=groups.get(key)??[];items.push(row);groups.set(key,items)}
 const todayRows=(groups.get(today)??[]).sort((a,b)=>a.startedAt.getTime()-b.startedAt.getTime());
 const todayTotal=todayRows.reduce((sum,row)=>sum+sessionDurationMs(row),0);
 const past=[...groups.entries()].filter(([key])=>key!==today).sort(([a],[b])=>b.localeCompare(a));
 const visibleToday=todayRows.length>3?todayRows.slice(0,3):todayRows;
 return <main className={styles.salesPage}>
  <header className={styles.heading}><h1>My Attendance</h1><p>Today’s work hours and attendance sessions are shown first.</p></header>
  <section className={styles.hero}><p className={styles.heroLabel}>Today’s Workhours</p><div className={styles.workHours}>{workDuration(todayTotal)}</div><small>{todayRows.length} session{todayRows.length===1?"":"s"} today</small></section>
  <div className={styles.sectionTitle}><h2>Today’s Attendance</h2><span>{dayLabel(today)}</span></div>
  {!todayRows.length?<div className={styles.empty}>No attendance session recorded today.</div>:<div className={styles.sessionList}>{visibleToday.map(row=><SessionCard key={row.id} row={row}/>)}</div>}
  {todayRows.length>3&&<details className={styles.expand}><summary>View all {todayRows.length} sessions</summary><div className={styles.expandContent}>{todayRows.map(row=><SessionCard key={row.id} row={row}/>)}</div></details>}
  <details className={styles.pastAction}><summary>Past Attendance · Last 35 Days</summary><div className={styles.pastBody}>
   <div className={styles.sectionTitle}><h2>Past Attendance</h2><span>Latest date first</span></div>
   {!past.length?<div className={styles.empty}>No past attendance found in the last 35 days.</div>:<div className={styles.pastList}>{past.map(([key,rows])=>rows.length>1?<details className={styles.dayCard} key={key}><summary className={styles.daySummary}><div className={styles.dayHeader}><strong>{dayLabel(key)}</strong><span>{rows.length} sessions ▾</span></div><DayStats rows={rows}/></summary><div className={styles.daySessions}>{[...rows].sort((a,b)=>a.startedAt.getTime()-b.startedAt.getTime()).map(row=><SessionCard key={row.id} row={row}/>)}</div></details>:<article className={`${styles.dayCard} ${styles.singleDay}`} key={key}><div className={styles.dayHeader}><strong>{dayLabel(key)}</strong><span>1 session</span></div><DayStats rows={rows}/><SessionCard row={rows[0]}/></article>)}</div>}
  </div></details>
 </main>
}
