import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {requirePermission} from "@/lib/auth/authorization";
import {searchCustomers} from "@/lib/customers/service";
import {getOwnPendingVisits} from "@/lib/visits/service";
import {VisitWorkspace} from "./visit-workspace";
import {listLeads} from "@/lib/leads/service";

export const metadata:Metadata={title:"Check-ins"};
export default async function CheckInsPage({searchParams}:{searchParams:Promise<{leadId?:string;followUpTaskId?:string}>}){
 const user=await requirePermission("SALES_CHECK_INS"),q=await searchParams;
 const fieldWorker=user.salesRole==="SALES"||(user.salesRole==="MANAGER"&&user.managerType!=="MANAGER_ONLY");
 if(!fieldWorker)redirect("/workspace/reports/check-ins");
 const[customers,pending,leads]=await Promise.all([searchCustomers(),getOwnPendingVisits(),listLeads({assignedUserId:user.id})]);
 return <main className="visits-shell"><section className="visits-content"><WorkspacePageHeader title="Check-ins" backHref="/workspace"/><VisitWorkspace customers={customers} pending={pending} leads={leads.map(l=>({id:l.id,title:l.title}))} initialLeadId={q.leadId} initialFollowUpTaskId={q.followUpTaskId}/></section></main>;
}
