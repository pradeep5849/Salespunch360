import {notFound}from"next/navigation";
import{WorkspacePageHeader}from"@/components/workspace/workspace-page-header";
import{requirePermission}from"@/lib/auth/authorization";
import{getLead,leadOptions}from"@/lib/leads/service";
import{EditLeadForm}from"../../edit-form";
export default async function LeadEditPage({params}:{params:Promise<{id:string}>}){const{id}=await params;await requirePermission("SALES_LEADS");const[lead,o]=await Promise.all([getLead(id),leadOptions()]);if(!lead)notFound();const dto={...lead,estimatedValue:lead.estimatedValue?.toFixed(2)||null,followUpAt:lead.followUpAt?.toISOString().slice(0,16)||null};return <main className="leads-shell"><section className="leads-content"><WorkspacePageHeader title={`Edit Lead · ${lead.title}`} backHref={`/workspace/leads/${lead.id}`} backLabel="Back to Lead"/><EditLeadForm lead={dto} users={o.users} customers={o.customers} returnHref={`/workspace/leads/${lead.id}`}/></section></main>}
