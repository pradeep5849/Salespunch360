import {reportActor} from "@/lib/reports/scope";
import {monthlyTargetRowsForActor} from "@/lib/targets/service";
import type {SearchParams} from "@/lib/reports/validation";
import {ReportHeader,Summary} from "../report-ui";

export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}){
 const p=await searchParams,r=await monthlyTargetRowsForActor(await reportActor()),selected=typeof p.employeeId==="string"?p.employeeId:"";
 const rows=selected?r.rows.filter(x=>x.id===selected):r.rows;
 const leadsTarget=rows.reduce((s,x)=>s+x.leadTarget,0),created=rows.reduce((s,x)=>s+x.created,0),wonTarget=rows.reduce((s,x)=>s+x.wonTarget,0),won=rows.reduce((s,x)=>s+x.won,0);
 return <main className="reports-content">
  <ReportHeader title="Target Analysis" description="Current calendar-month Target / Actual values use the same rules and data as Sales Targets."/>
  {r.actor.salesRole!=="SALES"&&<form className="report-filters"><label>Employee<select name="employeeId" defaultValue={selected}><option value="">All Employees</option>{r.rows.map(x=><option key={x.id} value={x.id}>{x.name} · {x.salesRole==="MANAGER"?"Field Manager":"Sales"}</option>)}</select></label><button>View Report</button></form>}
  <Summary items={[{label:"Check-ins Target",value:leadsTarget},{label:"Check-ins",value:created},{label:"Leads Won Target",value:wonTarget},{label:"Leads Won",value:won}]}/>
  <div className="monthly-target-table"><div className="monthly-target-head"><span>Employee</span><span>Check-ins Target / Actual</span><span>Leads Won Target / Actual</span></div>
   {rows.map(row=><div className="monthly-target-row target-analysis-row" key={row.id}><div><strong>{row.name}</strong><small>{row.salesRole==="MANAGER"?"Field Manager":"Sales"}</small></div><div className="target-metric"><strong>{row.leadTarget}</strong><span>/ {row.created}</span></div><div className="target-metric"><strong>{row.wonTarget}</strong><span>/ {row.won}</span></div></div>)}
  </div>
  {!rows.length&&<div className="empty-state">No target data is available for this employee selection.</div>}
 </main>;
}
