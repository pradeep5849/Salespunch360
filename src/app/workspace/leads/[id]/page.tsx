import Link from "next/link";
import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
import {notFound} from "next/navigation";
import {getLead,leadOptions} from "@/lib/leads/service";
import {EditLeadForm} from "../edit-form";
import {DeleteLead} from "../delete-lead";
import {requirePermission} from "@/lib/auth/authorization";
import {formatBusinessDate} from "@/lib/follow-up-tasks/date";
import {listLeadFollowUpTasks} from "@/lib/follow-up-tasks/lead-list";
import {ensureWonLeadProjectForActor} from "@/lib/leads/won-project";
import {getLeadCallHistory,leadCallCount} from "@/lib/telecalling/service";
import {CallResultForm} from "@/components/telecalling/call-result-form";

const callLabel=(s:string)=>s.toLowerCase().split("_").map(x=>x[0]?.toUpperCase()+x.slice(1)).join(" ");
export default async function LeadDetail({params}:{params:Promise<{id:string}>}){
 const{id}=await params;
 const[lead,o,user,followUps,calls,callHistory]=await Promise.all([getLead(id),leadOptions(),requirePermission("SALES_LEADS"),listLeadFollowUpTasks(id),leadCallCount(id),getLeadCallHistory(id)]);
 if(!lead)notFound();
 const project=lead.stage==="WON"&&user.companyId?await ensureWonLeadProjectForActor({id:user.id,companyId:user.companyId},lead.id):null;
 const dto={...lead,estimatedValue:lead.estimatedValue?.toFixed(2)||null,followUpAt:lead.followUpAt?.toISOString().slice(0,16)||null};
 const canManage=user.salesRole==="PRIMARY_ADMIN"||user.salesRole==="ADMIN"||lead.assignedUserId===user.id;
 return <main className="leads-shell"><section className="leads-content">
  <WorkspacePageHeader title={lead.title} backHref="/workspace/leads" backLabel="Back to Leads"/>
  <p className="lead-stage-label">{lead.stage}</p>
  <div className="flex gap-3 text-sm font-semibold"><span>Check-ins {lead.visits.length}</span><span>Calls {calls}</span></div>
  {project&&<p className="form-success" role="status">Project handover ready: {project.projectNumber}</p>}
  <div className="flex flex-wrap gap-2 py-2">
   <Link className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white no-underline" href={`/workspace/leads/${lead.id}/follow-up`}>Add Follow-up</Link>
   <a className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold no-underline" href="#edit-lead">Edit Lead</a>
   {canManage&&<a className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 no-underline" href="#delete-lead">Delete Lead</a>}
  </div>
  <div className="lead-detail"><p><b>Assigned:</b> {lead.assignedUser.name}</p><p><b>Customer/prospect:</b> {lead.customer?.name||lead.companyName||"Not specified"}</p><p><b>Source:</b> {lead.source}{lead.sourceVisitId?` · Visit ${lead.sourceVisitId}`:""}</p><p><b>Value:</b> {lead.estimatedValue?`${lead.currencyCode} ${lead.estimatedValue.toFixed(2)}`:"Not specified"}</p><p><b>Next follow-up:</b> {lead.followUpAt?formatBusinessDate(lead.followUpAt):"None"}</p>{lead.lostReason&&<p><b>Lost reason:</b> {lead.lostReason}</p>}<p><b>Created:</b> {lead.createdAt.toLocaleString()} · <b>Updated:</b> {lead.updatedAt.toLocaleString()}</p></div>
  <section className="activity"><h2>Call</h2><CallResultForm leadId={lead.id} phone={lead.phone}/></section>
  <section className="activity"><h2>Call History · {calls}</h2>{callHistory.length?callHistory.map(c=><article key={c.id}><strong>{callLabel(c.result)} · {c.callerName}</strong><span>{c.calledAt.toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</span>{c.notes&&<small>{c.notes}</small>}{c.nextCallbackAt&&<small>Callback {c.nextCallbackAt.toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</small>}</article>):<p>No saved calls for this lead.</p>}</section>
  <section className="activity"><h2>Follow-up History</h2>{followUps.length?followUps.map(task=><article key={task.id}><strong>{task.type==="CALL"?"Call":"Visit"} · {task.status}</strong><span>Due {formatBusinessDate(task.dueDate)} · Assigned to {task.assignedUser.name}</span>{task.notes&&<small>{task.notes}</small>}<small>Created by {task.createdByUser.name} · {task.createdAt.toLocaleString()}</small></article>):<p>No follow-ups added for this lead.</p>}</section>
  <section className="activity"><h2>Check-in History</h2>{lead.visits.length?lead.visits.map(v=><article id={`visit-${v.id}`} key={v.id}><strong>{v.user.name} · {v.checkedOutAt?"Completed":"Pending"}</strong><span>Checked in {v.checkedInAt.toLocaleString()}</span><small>{v.checkedOutAt?`Checked out ${v.checkedOutAt.toLocaleString()}`:"No checkout recorded"}</small><small>{v.checkInAddress||`${v.checkInLatitude.toFixed(5)}, ${v.checkInLongitude.toFixed(5)}`}</small>{v.visitNotes&&<small>{v.visitNotes}</small>}</article>):<p>No authorized check-ins recorded for this lead.</p>}</section>
  <section id="edit-lead"><EditLeadForm lead={dto} users={o.users} customers={o.customers}/></section>
  {canManage&&<section id="delete-lead" className="activity"><h2>Delete Lead</h2><p>Delete this lead only if it is no longer required. This action is permanent.</p><DeleteLead leadId={lead.id}/></section>}
  <section className="activity"><h2>Activity</h2>{lead.activities.map(x=><article key={x.id}><strong>{x.type.replaceAll("_"," ")}</strong><span>{x.actorUser.name} · {x.createdAt.toLocaleString()}</span>{x.fromStage&&<small>{x.fromStage} → {x.toStage}</small>}</article>)}</section>
 </section></main>;
}
