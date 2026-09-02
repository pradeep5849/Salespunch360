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
  <ReportHeader title="Expense Report" description="Daily travel uses accepted GPS points and the employee custom rate or company default rate. Company Admin approves each employee day separately."/>
  <DownloadExcel report="expenses" params={raw} ready={reportQueryWasRun(raw)}/>
  <Filters filters={r.filters} employees={r.employees}/>
  <Summary items={[{label:"Daily records",value:r.rows.length},{label:"Pending",value:pending},{label:"Approved",value:approved},{label:"Rejected",value:rejected}]}/>
  <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Employee</th><th>Date</th><th>Eligible distance</th><th>Rate / km</th><th>Total amount</th><th>Status</th><th>Approval</th></tr></thead><tbody>
   {r.rows.map(row=><tr key={row.key}><td>{row.employee}</td><td>{row.date}</td><td>{distance(row.distanceMeters)}</td><td>{row.ratePerKm?money(row.ratePerKm):"Not configured"}</td><td>{money(row.amount)}</td><td><strong>{row.status??"RATE REQUIRED"}</strong></td><td>
    {r.actor.role==="COMPANY_ADMIN"&&row.status&&<div className="expense-approval-actions"><form action={reviewDailyTravelAction}><input type="hidden" name="employeeId" value={row.employeeId}/><input type="hidden" name="date" value={row.date}/><input type="hidden" name="status" value="APPROVED"/><button disabled={row.status==="APPROVED"}>Approve</button></form><form action={reviewDailyTravelAction}><input type="hidden" name="employeeId" value={row.employeeId}/><input type="hidden" name="date" value={row.date}/><input type="hidden" name="status" value="REJECTED"/><button className="danger-button" disabled={row.status==="REJECTED"}>Reject</button></form></div>}
   </td></tr>)}
  </tbody></table></div>
  {!r.rows.length&&<div className="empty-state">No travel-enabled employee has accepted GPS distance for these filters.</div>}
  {!r.companyRate&&<p className="gps-warning">Set a company travel rate in Settings, or set a custom rate in Employee Details, before amounts can be calculated.</p>}
 </main>;
}
