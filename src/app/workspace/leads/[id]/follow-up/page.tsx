import {notFound} from "next/navigation";
import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
import {requirePermission} from "@/lib/auth/authorization";
import {getLead} from "@/lib/leads/service";
import {telecallerFollowUpOptions} from "@/lib/follow-up-tasks/telecaller-assignment";
import {FollowUpForm} from "../../follow-up-form";

export default async function LeadFollowUpPage({params}:{params:Promise<{id:string}>}){
 const{id}=await params;
 await requirePermission("SALES_LEADS");
 const[lead,telecallers]=await Promise.all([getLead(id),telecallerFollowUpOptions()]);
 if(!lead)notFound();
 return <main className="leads-shell"><section className="leads-content">
  <WorkspacePageHeader title={`Add Follow-up · ${lead.title}`} backHref="/workspace/leads" backLabel="Back to Leads"/>
  <p className="follow-up-help">Set the follow-up type, due date and notes. Call follow-ups can be assigned to an active paid Telecaller.</p>
  <FollowUpForm leadId={lead.id} assignee={lead.assignedUser.name} telecallers={telecallers}/>
 </section></main>;
}
