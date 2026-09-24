import Link from "next/link";
import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
import {requirePermission} from "@/lib/auth/authorization";
import {listCallbackQueue,listSalesActions,listTelecallingLeads,splitCallbackQueue} from "@/lib/telecalling/service";
import {listAssignedTelecallerCallsForActor} from "@/lib/follow-up-tasks/telecaller-assignment";
import {CallResultForm} from "@/components/telecalling/call-result-form";
import {changeSalesAction} from "@/app/actions/telecalling";

const fmt=(d:Date|null)=>d?d.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}):"—";
const label=(value:string)=>value.toLowerCase().split("_").map(x=>x[0]?.toUpperCase()+x.slice(1)).join(" ");

export default async function TelecallingPage({searchParams}:{searchParams:Promise<{q?:string}>}){
 const actor=await requirePermission("SALES_TELECALLING");
 if(!actor.companyId||!actor.salesRole)throw new Error("Company Sales access required");
 const {q}=await searchParams,search=q?.trim()||"";
 const assignedPromise=listAssignedTelecallerCallsForActor({...actor,companyId:actor.companyId,salesRole:actor.salesRole});
 const [leads,callbacks,assignedCalls,actions]=await Promise.all([search?listTelecallingLeads(search):Promise.resolve([]),listCallbackQueue(),assignedPromise,listSalesActions()]);
 const queues=splitCallbackQueue([...callbacks,...assignedCalls]);
 const assignedById=new Map(assignedCalls.map(item=>[item.id,item]));
 return <main className="leads-shell"><section className="leads-content">
  <WorkspacePageHeader title="Telecalling" backHref="/workspace"/>
  <p className="follow-up-help">Call scheduled leads, save the result, and search any authorized company lead when required.</p>
  <nav className="task-tabs">{queues.map(([title,items])=><a href={`#tele-${title.toLowerCase()}`} key={title}>{title} · {items.length}</a>)}</nav>
  {queues.map(([title,items])=><section className="telecalling-section" id={`tele-${title.toLowerCase()}`} key={title}><h2>{title}<span>{items.length}</span></h2>{items.length===0?<p className="telecalling-empty">No calls.</p>:items.slice(0,100).map(item=>{const assigned=assignedById.get(item.id),taskId=assigned?.followUpTaskId,assignedTo=assigned?.assigneeName??item.callerName;return <article className="telecalling-card" key={`${taskId?"task":"callback"}-${item.id}`}><div className="telecalling-card-title"><strong>{item.leadTitle}</strong><span className="lead-stage-badge">{fmt(item.nextCallbackAt)}</span></div><div className="telecalling-meta"><span>Owner: {item.ownerName}</span><span>Assigned: {assignedTo}</span><span>{item.phone||"No mobile"}</span></div>{item.notes&&<p>{item.notes}</p>}<details className="telecalling-save"><summary>Call / Save Result</summary><CallResultForm leadId={item.leadId} phone={item.phone} compact followUpTaskId={taskId&&item.callbackAssigneeUserId===actor.id?taskId:undefined}/></details></article>})}</section>)}
  <section className="telecalling-section"><h2>Find a Lead</h2><form className="telecalling-search"><input name="q" defaultValue={search} placeholder="Search lead, contact or mobile"/><button>Search</button></form>{!search&&<p className="telecalling-empty">Search when you need to call a company lead. The full company lead list is not shown by default.</p>}{search&&<><h3 className="telecalling-result-heading">Search Results · {leads.length}</h3>{leads.length===0?<p className="telecalling-empty">No matching leads.</p>:leads.map(lead=><article className="telecalling-card" key={lead.id}><div className="telecalling-card-title"><strong>{lead.title}</strong><span className="lead-stage-badge">{label(lead.stage)}</span></div><div className="telecalling-meta"><span>Owner: {lead.ownerName}</span><span>Calls: {lead.calls}</span><span>{lead.phone||"No mobile"}</span></div><details className="telecalling-save"><summary>Call / Save Result</summary><CallResultForm leadId={lead.id} phone={lead.phone} compact/></details></article>)}</>}</section>
  {actions.length?<section className="telecalling-section"><h2>Sales Handoffs <span>{actions.length}</span></h2><p className="follow-up-help">Interested, Wants Visit and Wants Quotation stay with the existing lead owner.</p>{actions.map(a=><article className="telecalling-card" key={a.id}><div className="telecalling-card-title"><strong>{a.leadTitle} · {label(a.trigger)}</strong><span className="lead-stage-badge">{a.status.replaceAll("_"," ")}</span></div><div className="telecalling-meta"><span>Caller: {a.callerName}</span><span>Sales: {a.ownerName}</span><span>{fmt(a.calledAt)}</span></div>{a.notes&&<p>{a.notes}</p>}<div className="telecalling-actions"><Link className="secondary" href={`/workspace/leads/${a.leadId}`}>Open Lead</Link>{a.status==="PENDING"?<form action={changeSalesAction}><input type="hidden" name="actionId" value={a.id}/><input type="hidden" name="status" value="ACKNOWLEDGED"/><button className="secondary">Acknowledge</button></form>:null}{a.status!=="ACTION_TAKEN"?<form action={changeSalesAction}><input type="hidden" name="actionId" value={a.id}/><input type="hidden" name="status" value="ACTION_TAKEN"/><button className="primary">Action Taken</button></form>:null}</div></article>)}</section>:null}
 </section></main>;
}
