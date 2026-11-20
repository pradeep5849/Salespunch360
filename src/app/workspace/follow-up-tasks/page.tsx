import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
import Link from "next/link";
import {TaskActionForm} from "./task-action-form";
import {listFollowUpTasks,taskActor,taskEmployeeOptions} from "@/lib/follow-up-tasks/service";


const states=["ALL","TODAY","UPCOMING","OVERDUE","PENDING","CLOSED","CANCELLED"] as const;
const label=(s:string)=>s==="TODAY"?"Due Today":s[0]+s.slice(1).toLowerCase();
const fmt=(d:Date)=>d.toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"});

export default async function FollowUpTasksPage({searchParams}:{searchParams:Promise<{status?:string;employeeId?:string;page?:string;leadId?:string}>}){
 const q=await searchParams;
 if(q.status==="COMPLETED")q.status="CLOSED";
 const selected=states.includes(q.status as typeof states[number])?q.status!:"TODAY";
 const page=Math.max(1,Math.min(100000,Math.trunc(Number(q.page))||1));
 const[actor,rawTasks,employees]=await Promise.all([taskActor(),listFollowUpTasks({...q,status:selected,page}),taskEmployeeOptions()]);
 const tasks=rawTasks.slice(0,50),hasMore=rawTasks.length>50;
 const href=(status:string,nextPage=1)=>{const params=new URLSearchParams({status,page:String(nextPage)});if(q.employeeId)params.set("employeeId",q.employeeId);if(q.leadId)params.set("leadId",q.leadId);return `/workspace/follow-up-tasks?${params}`;};
 return <main className="leads-shell"><section className="leads-content">
  <WorkspacePageHeader title="Follow-ups" backHref="/workspace"/>
  <nav className="task-tabs">{states.map(s=><Link className={selected===s?"active":""} key={s} href={href(s)}>{label(s)}</Link>)}</nav>
  {actor.salesRole!=="SALES"&&<form className="lead-filters"><input type="hidden" name="status" value={selected}/>{q.leadId&&<input type="hidden" name="leadId" value={q.leadId}/>}<select name="employeeId" defaultValue={q.employeeId||""}><option value="">All permitted employees</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select><button>Filter</button></form>}
  <p className="muted">Calls close after an outcome is saved. Visits close after checkout. Unattended follow-ups stay pending; overdue work is reported to Admins.</p><div className="task-list">
   {tasks.length===0&&<p className="pending-empty">No follow-ups in {label(selected)}.</p>}
   {tasks.map(t=>{
    const own=t.assignedUserId===actor.id,isCall=t.type==="CALL";
    const last=t.status==="COMPLETED"?(isCall?"Call completed":"Checkout completed"):t.status==="CANCELLED"?"Cancelled":t.completedVisitId?"Follow-up check-in started":isCall?"Call pending":"Visit pending";
    return <article key={t.id}>
     <div className="card-title"><h2>{t.lead.customer?.name||t.lead.companyName||t.lead.title}</h2><b>{t.status==="COMPLETED"?"Closed":t.status==="PENDING"?"Pending": "Cancelled"}</b></div>
     <p><strong>Type:</strong> {isCall?"Call":"Visit"} · <strong>Lead:</strong> {t.lead.title}</p>
     <p><strong>Assigned:</strong> {t.assignedUser.name} · <strong>Due:</strong> {t.dueDate.toISOString().slice(0,10)}</p>
     <p><strong>Last action:</strong> {last}</p>
     {t.notes&&<p>{t.notes}</p>}
     <small>Task created by {t.createdByUser.name} · {fmt(t.createdAt)}</small>
     <div className="task-activity"><span>Task created by {t.createdByUser.name}</span><span>→ Assigned to {t.assignedUser.name}</span>{t.completedVisit&&<><span>→ Follow-up check-in done by {t.completedVisit.user.name} · {fmt(t.completedVisit.checkedInAt)}</span>{t.completedVisit.checkedOutAt&&<span>→ Checkout completed · {fmt(t.completedVisit.checkedOutAt)}</span>}</>}{isCall&&t.completedAt&&<span>→ Call completed · {fmt(t.completedAt)}</span>}{!isCall&&t.completedAt&&<span>→ Task completed · {fmt(t.completedAt)}</span>}{t.status==="CANCELLED"&&<span>→ Cancelled</span>}</div>
     <div className="task-actions"><Link href={`/workspace/leads/${t.leadId}`}>View Lead</Link>{t.completedVisitId&&<Link href={`/workspace/leads/${t.leadId}#visit-${t.completedVisitId}`}>View Visit</Link>}{!isCall&&own&&t.status==="PENDING"&&!t.completedVisitId&&<Link href={`/workspace/check-ins?leadId=${t.leadId}&followUpTaskId=${t.id}`}>Start Follow-up Check-in</Link>}{isCall&&own&&t.status==="PENDING"&&!t.completedVisitId&&<TaskActionForm taskId={t.id} kind="CALL"/>}{t.status==="PENDING"&&!t.completedVisitId&&<TaskActionForm taskId={t.id} kind="CANCEL"/>}</div>
    </article>;
   })}
  </div>
  <nav aria-label="Follow-up pages">{page>1&&<Link href={href(selected,page-1)}>Previous</Link>} <span>Page {page}</span> {hasMore&&<Link href={href(selected,page+1)}>Next</Link>}</nav>
 </section></main>;
}
