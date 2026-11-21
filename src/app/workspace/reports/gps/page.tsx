import {DownloadExcel} from "@/components/workspace/download-excel";
import {gpsReport,type GpsTimelineEvent} from "@/lib/reports/gps";
import type {SearchParams} from "@/lib/reports/validation";
import {dateTime,distance,ReportHeader,Summary} from "../report-ui";
import {GoogleRouteMap} from "../google-route-map";

const names:Record<GpsTimelineEvent["type"],string>={
 ATTENDANCE_STARTED:"Attendance Started",
 GPS_STARTED:"GPS Started",
 VISIT:"Customer Visit",
 GPS_ENDED:"GPS Ended",
 GPS_LAST_RECORDED:"Last GPS Recorded",
 ATTENDANCE_ENDED:"Attendance Ended",
};

export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}){
 const raw=await searchParams;
 const r=await gpsReport(raw);
 return <main className="reports-content">
  <ReportHeader title="GPS Report" description="Choose an authorized employee and one calendar date. GPS distance is counted only while attendance is active."/>
  <DownloadExcel report="gps" params={raw} ready={Boolean(r.employee)}/>
  <form className="report-filters gps-daily-filters">
   {r.actor.salesRole!=="SALES"&&<label>Employee<select name="employeeId" defaultValue={r.employeeId||""} required><option value="">Select employee</option>{r.employees.map(e=><option value={e.id} key={e.id}>{e.name} · {e.salesRole}</option>)}</select></label>}
   <label>Date<input type="date" name="date" defaultValue={r.date||""} required/></label>
   <button>View Report</button>
  </form>
  {r.employee&&<>
   <Summary items={[
    {label:"Employee",value:r.employee.name},
    {label:"Measured GPS points",value:r.points.length},
    {label:"Customer visits",value:r.visitCount},
    {label:"Total Distance Covered",value:distance(r.routeDistanceMeters)},
   ]}/>
   <section className="gps-warning"><strong>Last spotted</strong><p>{r.lastSpottedAt?dateTime(r.lastSpottedAt):"No GPS point recorded for this day."}</p></section>
   <GoogleRouteMap points={r.points} segments={r.segments} markers={r.markers}/>
   <section className="gps-timeline"><h2>Daily timeline</h2>{r.events.length?r.events.map((e,index)=><article key={e.id}><i>{index+1}</i><div><strong>{names[e.type]}{e.customer?` · ${e.customer}`:""}</strong><time>{dateTime(e.at)}</time>{e.detail&&<p>{e.detail}</p>}{e.latitude!=null&&e.longitude!=null&&<small>{e.latitude.toFixed(6)}, {e.longitude.toFixed(6)}</small>}</div></article>):<div className="empty-state">No stored attendance, GPS, or visit events exist for this date.</div>}</section>
   <section className="gps-warning"><strong>Attendance-linked GPS</strong><p>The map and distance use the same quality-filtered GPS points captured while attendance was ON. Poor accuracy, jitter and implausible movement are excluded. Separate attendance periods and long recording gaps are not connected. Last spotted uses the latest stored GPS timestamp; it does not confirm current tracking.</p></section>
  </>}
  {!r.employee&&<div className="empty-state">Choose an employee and date to view the authorized daily GPS report.</div>}
 </main>;
}
