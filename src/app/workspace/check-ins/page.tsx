import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";import type {Metadata} from "next";
import {requireUser} from "@/lib/auth/authorization";
import {searchCustomers} from "@/lib/customers/service";
import {getOwnPendingVisits,getVisibleRecentVisits} from "@/lib/visits/service";
import {VisitWorkspace} from "./visit-workspace";
import {listLeads} from "@/lib/leads/service";

export const metadata:Metadata={title:"Check-ins"};
export default async function CheckInsPage({searchParams}:{searchParams:Promise<{leadId?:string;followUpTaskId?:string}>}){const user=await requireUser(),q=await searchParams;const employee=user.role==="MANAGER"||user.role==="SALES";const [customers,pending,leads]=employee?await Promise.all([searchCustomers(),getOwnPendingVisits(),listLeads({assignedUserId:user.id})]):[[],[],[]];const recent=user.role==="COMPANY_ADMIN"||user.role==="MANAGER"?await getVisibleRecentVisits():[];return <main className="visits-shell"><section className="visits-content"><WorkspacePageHeader title="Check-ins" backHref="/workspace"/>{employee&&<VisitWorkspace customers={customers} pending={pending} leads={leads.map(l=>({id:l.id,title:l.title}))} initialLeadId={q.leadId} initialFollowUpTaskId={q.followUpTaskId}/>} {recent.length>0&&<section className="recent-visits"><h2>Current and recent visits</h2>{recent.map(v=><article key={v.id}><div><strong>{v.user.name}</strong><span>{v.user.role} · {v.customer?.name||v.contactName||"Field prospect"}</span></div><div><strong>{v.checkedOutAt?"Completed":"Pending checkout"}</strong><span>{v.checkedInAt.toLocaleString("en-US",{timeZone:"UTC"})} UTC{v.checkoutSentiment?` · ${v.checkoutSentiment}`:""}</span></div></article>)}</section>}</section></main>}
