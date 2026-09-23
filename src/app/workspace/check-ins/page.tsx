import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {requirePermission} from "@/lib/auth/authorization";
import {searchCustomers} from "@/lib/customers/service";
import {getOwnPendingVisits} from "@/lib/visits/service";
import {VisitWorkspace} from "./visit-workspace";
import {listFollowUpTasks} from "@/lib/follow-up-tasks/service";

export const metadata:Metadata={title:"Check-ins"};
export default async function CheckInsPage({searchParams}:{searchParams:Promise<{leadId?:string;followUpTaskId?:string}>}){
 const user=await requirePermission("SALES_CHECK_INS"),q=await searchParams;
 const fieldWorker=user.salesRole==="SALES"||(user.salesRole==="MANAGER"&&user.managerType!=="MANAGER_ONLY");
 if(!fieldWorker)redirect("/workspace/reports/check-ins");
 const employeeId=user.id;
 const[customers,pending,overdue,today,upcoming]=await Promise.all([
  searchCustomers(),
  getOwnPendingVisits(),
  listFollowUpTasks({status:"OVERDUE",employeeId}),
  listFollowUpTasks({status:"TODAY",employeeId}),
  listFollowUpTasks({status:"PENDING",employeeId}),
 ]);
 const followUps=[
  ...overdue.map(task=>({task,bucket:"Overdue"})),
  ...today.map(task=>({task,bucket:"Due Today"})),
  ...upcoming.map(task=>({task,bucket:"Upcoming"})),
 ].filter(({task})=>task.type==="VISIT"&&task.assignedUserId===user.id&&task.status==="PENDING"&&!task.completedVisitId)
  .map(({task,bucket})=>({id:task.id,leadId:task.leadId,title:task.lead.title,dueDate:task.dueDate.toISOString().slice(0,10),bucket}));
 return <main className="visits-shell"><section className="visits-content"><WorkspacePageHeader title="Check-ins" backHref="/workspace"/><VisitWorkspace customers={customers} pending={pending} followUps={followUps} initialLeadId={q.leadId} initialFollowUpTaskId={q.followUpTaskId}/></section></main>;
}
