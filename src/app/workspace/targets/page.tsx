import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
import {monthlyTargetRows} from "@/lib/targets/service";
import {saveMonthlyTargetsAction} from "@/app/actions/targets";

export default async function Page(){
 const r=await monthlyTargetRows(),canEdit=r.actor.role!=="SALES";
 return <main className="targets-content"><WorkspacePageHeader title="Sales Targets" backHref="/workspace"/>
  <p className="muted">Monthly targets run from the 1st to the last day of the month. Target numbers carry forward automatically; Created and Won actuals restart each month.</p>
  <div className="monthly-target-table"><div className="monthly-target-head"><span>Employee</span><span>Leads · Target / Created</span><span>Won · Target / Won</span></div>
   {r.rows.map(row=><form action={saveMonthlyTargetsAction} className="monthly-target-row" key={row.id}><input type="hidden" name="assignedUserId" value={row.id}/><div><strong>{row.name}</strong><small>{row.role==="MANAGER"?"Field Manager":"Sales"}</small></div><div className="target-metric">{canEdit?<input name="leadTarget" type="number" min="0" step="1" defaultValue={row.leadTarget}/>:<strong>{row.leadTarget}</strong>}<span>/ {row.created}</span></div><div className="target-metric">{canEdit?<input name="wonTarget" type="number" min="0" step="1" defaultValue={row.wonTarget}/>:<strong>{row.wonTarget}</strong>}<span>/ {row.won}</span></div>{canEdit&&<button>Save</button>}</form>)}
  </div>
  {!r.rows.length&&<div className="empty-state">No active field employees are visible in your current scope.</div>}
 </main>;
}
