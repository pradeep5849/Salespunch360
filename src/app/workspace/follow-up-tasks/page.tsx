import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
import Link from "next/link";
import {cancelFollowUpTaskAction,completeCallFollowUpTaskAction} from "@/app/actions/follow-up-tasks";
import {listFollowUpTasks,taskActor,taskEmployeeOptions} from "@/lib/follow-up-tasks/service";
import {indiaDateText,parseIndiaBusinessDate} from "@/lib/follow-up-tasks/date";

const states=["TODAY","OVERDUE","PENDING","COMPLETED","CANCELLED"] as const;
const label=(s:string)=>s==="TODAY"?"Due Today":s[0]+s.slice(1).toLowerCase();
const fmt=(d:Date)=>d.toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"});

export default async function FollowUpTasksPage({searchParams}:{searchParams:Promise<{status?:string;employeeId?:string}>}){
 const q=await searchParams,selected=states.includes(q.status as typeof states[number])?q.status!:"TODAY";
 const[actor,rawTasks,employees]=await Promise.all([taskActor(),listFollowUpTasks(q),taskEmployeeOptions()]);
 const tomorrow=new Date(parseIndiaBusinessDate(indiaDateText()).getTime()+86_400_000);
 const tasks=selected==="PENDING"?rawTasks.filter(task=>task.dueDate>=tomorrow):rawTasks;
 return <main className="leads-shell"><section className="leads-content">
  <WorkspacePageHeader title="Follow-ups" backHref="/workspace"/>
  <nav className="task-tabs">{states.map(s=><Link className={selected===s?"active":""} key={s} href={`/workspace/follow-up-tasks?status=${s}`}>{label(s)}</Link>)}</nav>
  {actor.salesRole!=="SALES"&&<form className="lead-filters"><input type="hidden" name="status" value={selected}/><select name="employeeId" defaultValue={q.employeeId||""}><option value="">All permitted employees</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select><button>Filter</button></form>}
  <div className="task-list">
   {tasks.length===0&&<p className="pending-empty">No follow-ups in {label(selected)}.</p>}
   {tasks.map(t=>{
    const own=t.assignedUserId===actor.id,canManage=own||actor.salesRole!=="SALES",isCall=t.type==="CALL";
    const last=t.status==="COMPLETED"?(isCall?"Call completed":"Checkout completed"):t.status==="CANCELLED"?"Cancelled":t.completedVisitId?"Follow-up check-in started":isCall?"Call pending":"Visit pending";
    return <article key={t.id}>
     <div className="card-title"><h2>{t.lead.customer?.name||t.lead.companyName||t.lead.title}</h2><b>{t.status}</b></div>
     <p><strong>Type:</strong> {isCall?"Call":"Visit"} · <strong>Lead:</strong> {t.lead.title}</p>
     <p><strong>Assigned:</strong> {t.assignedUser.name} · <strong>Due:</strong> {t.dueDate.toISOString().slice(0,10)}</p>
     <p><strong>Last action:</strong> {last}</p>
     {t.notes&&<p>{t.notes}</p>}
     <small>Task created by {t.createdByUser.name} · {fmt(t.createdAt)}</small>
     <div className="task-activity"><span>Task created by {t.createdByUser.name}</span><span>→ Assigned to {t.assignedUser.name}</span>{t.completedVisit&&<><span>→ Follow-up check-in done by {t.completedVisit.user.name} · {fmt(t.completedVisit.checkedInAt)}</span>{t.completedVisit.checkedOutAt&&<span>→ Checkout completed · {fmt(t.completedVisit.checkedOutAt)}</span>}</>}{isCall&&t.completedAt&&<span>→ Call completed · {fmt(t.completedAt)}</span>}{!isCall&&t.completedAt&&<span>→ Task completed · {fmt(t.completedAt)}</span>}{t.status==="CANCELLED"&&<span>→ Cancelled</span>}</div>
     <div className="task-actions"><Link href={`/workspace/leads/${t.leadId}`}>View Lead</Link>{t.completedVisitId&&<Link href={`/workspace/leads/${t.leadId}#visit-${t.completedVisitId}`}>View Visit</Link>}{!isCall&&own&&t.status==="PENDING"&&!t.completedVisitId&&<Link href={`/workspace/check-ins?leadId=${t.leadId}&followUpTaskId=${t.id}`}>Start Follow-up Check-in</Link>}{isCall&&canManage&&t.status==="PENDING"&&!t.completedVisitId&&<form action={completeCallFollowUpTaskAction}><input type="hidden" name="taskId" value={t.id}/><button>Mark Call Completed</button></form>}{t.status==="PENDING"&&!t.completedVisitId&&<form action={cancelFollowUpTaskAction}><input type="hidden" name="taskId" value={t.id}/><button>Cancel</button></form>}</div>
    </article>;
   })}
  </div>
 </section></main>;
}
