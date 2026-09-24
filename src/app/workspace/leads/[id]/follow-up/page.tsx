import {notFound} from "next/navigation";
import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
import {requirePermission} from "@/lib/auth/authorization";
import {getLead} from "@/lib/leads/service";
import {FollowUpForm} from "../../follow-up-form";

export default async function LeadFollowUpPage({params}:{params:Promise<{id:string}>}){
 const{id}=await params;
 await requirePermission("SALES_LEADS");
 const lead=await getLead(id);
 if(!lead)notFound();
 return <main className="leads-shell"><section className="leads-content">
  <WorkspacePageHeader title={`Add Follow-up · ${lead.title}`} backHref={`/workspace/leads/${lead.id}`} backLabel="Back to Lead"/>
  <p className="text-sm text-slate-600">Set only the follow-up type, due date and notes for this Lead.</p>
  <FollowUpForm leadId={lead.id} assignee={lead.assignedUser.name}/>
 </section></main>;
}
