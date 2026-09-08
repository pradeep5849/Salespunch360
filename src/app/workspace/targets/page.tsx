import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
import {monthlyTargetRows} from "@/lib/targets/service";
import {MonthlyTargetRow} from "./monthly-target-row";

export default async function Page(){
 const r=await monthlyTargetRows(),canEdit=r.actor.salesRole!=="SALES";
 return <main className="targets-content"><WorkspacePageHeader title="Sales Targets" backHref="/workspace"/>
  <p className="muted">Monthly targets run from the 1st to the last day of the month. Target numbers carry forward automatically; Created and Won actuals restart each month.</p>
  <div className="monthly-target-table"><div className="monthly-target-head"><span>Employee</span><span>Leads · Target / Created</span><span>Won · Target / Won</span><span>Action</span></div>
   {r.rows.map(row=><MonthlyTargetRow key={row.id} row={row} canEdit={canEdit}/>)}
  </div>
  {!r.rows.length&&<div className="empty-state">No active field employees are visible in your current scope.</div>}
 </main>;
}
