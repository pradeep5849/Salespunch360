import {DownloadExcel,reportQueryWasRun} from "@/components/workspace/download-excel";
import {expenseReport} from "@/lib/reports/expenses";
import type {SearchParams} from "@/lib/reports/validation";
import {distance,Filters,ReportHeader,Summary} from "../report-ui";
import {reviewDailyTravelAction} from "@/app/actions/travel";

const money=(v:{toFixed(n:number):string}|null)=>v?"₹"+v.toFixed(2):"—";

export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}){
 const raw=await searchParams,r=await expenseReport(raw);
 const pending=r.rows.filter(x=>x.status==="PENDING").length,approved=r.rows.filter(x=>x.status==="APPROVED").length,rejected=r.rows.filter(x=>x.status==="REJECTED").length;
 return <main className="reports-content">
  <ReportHeader title="Expense Report" description="Daily travel uses validated GPS movement only while attendance is active. Each user's ₹/km rate and Manual/Auto approval setting are applied separately."/>
  <DownloadExcel report="expenses" params={raw} ready={reportQueryWasRun(raw)}/>
  <Filters filters={r.filters} employees={r.employees}/>
  <Summary items={[{label:"Daily records",value:r.rows.length},{label:"Pending",value:pending},{label:"Approved",value:approved},{label:"Rejected",value:rejected}]}/>
  <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Employee</th><th>Date</th><th>Daily distance</th><th>Rate / km</th><th>Calculated amount</th><th>Approval mode</th><th>Status</th><th>Approved amount</th><th>Approval</th></tr></thead><tbody>
   {r.rows.map(row=><tr key={row.key}><td>{row.employee}</td><td>{row.date}</td><td>{distance(row.distanceMeters)}</td><td>{row.ratePerKm?money(row.ratePerKm):"Not configured"}</td><td>{money(row.amount)}</td><td>{row.approvalMode==="AUTO"?"Auto":"Manual"}</td><td><strong>{row.status??"RATE REQUIRED"}</strong></td><td>{money(row.approvedAmount)}</td><td>
    {r.actor.salesRole==="PRIMARY_ADMIN"&&row.approvalMode==="MANUAL"&&row.status&&<div className="expense-approval-actions"><form action={reviewDailyTravelAction}><input type="hidden" name="branchId" value={row.branchId}/><input type="hidden" name="employeeId" value={row.employeeId}/><input type="hidden" name="date" value={row.date}/><input type="hidden" name="status" value="APPROVED"/><button disabled={row.status==="APPROVED"}>Approve</button></form><form action={reviewDailyTravelAction}><input type="hidden" name="branchId" value={row.branchId}/><input type="hidden" name="employeeId" value={row.employeeId}/><input type="hidden" name="date" value={row.date}/><input type="hidden" name="status" value="REJECTED"/><button className="danger-button" disabled={row.status==="REJECTED"}>Reject</button></form></div>}
    {row.approvalMode==="AUTO"&&row.status==="APPROVED"?<span className="muted">Auto-approved</span>:null}
   </td></tr>)}
  </tbody></table></div>
  {!r.rows.length&&<div className="empty-state">No travel-enabled employee has accepted GPS distance for these filters.</div>}
  {!r.companyRate&&r.rows.some(row=>!row.ratePerKm)&&<p className="gps-warning">Set a custom rate on each employee (recommended), or configure the company fallback travel rate, before amounts can be calculated.</p>}
 </main>;
}
