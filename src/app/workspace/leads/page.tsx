import {isTelecallerDesignation} from "@/lib/telecalling/policy";
import {ListPagination} from "@/components/workspace/list-pagination";
import Link from "next/link";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import {LeadStage} from "@prisma/client";

import {leadScopeOptions,leadActor,leadStageCounts,listLeadsPageForActor,listPendingVisitsPageForActor,pendingVisitCountScopedForActor} from "@/lib/leads/service";
import {leadVisitCount} from "@/lib/leads/policy";
import {formatIndiaDateTime} from "@/lib/time/india";
import {PendingPhoneForm} from "./pending-phone-form";
import {StageForm} from "./stage-form";
import {LeadCallAction} from "./lead-call-action";

export const metadata={title:"Leads pipeline"};
const pipeline:{stage:LeadStage;label:string}[]=[
 {stage:"NEW",label:"Lead"},{stage:"QUALIFIED",label:"Qualified"},{stage:"PROPOSAL",label:"Prospecting"},
 {stage:"NEGOTIATION",label:"Quote Given"},{stage:"WON",label:"Won"},{stage:"LOST",label:"Lost"},
];
const stageLabel=(stage:LeadStage)=>pipeline.find(x=>x.stage===stage)?.label||stage;
export default async function LeadsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await leadActor(),q=await searchParams,isPending=q.view==="pending";
 if(!user.companyId)throw new Error("Company access required");
 const actor={...user,companyId:user.companyId};
 const filters={page:q.page,pageSize:50,stage:LeadStage[q.stage as keyof typeof LeadStage],assignedUserId:q.assignedUserId||undefined,q:q.q||undefined};
 const[page,scopeOptions,counts,pending,pendingCount]=await Promise.all([listLeadsPageForActor(actor,filters),leadScopeOptions(),leadStageCounts(filters.assignedUserId,filters.q),isPending?listPendingVisitsPageForActor(actor,filters.assignedUserId,filters.q,{page:q.page,pageSize:50}):Promise.resolve({items:[],page:1,pageSize:50,hasMore:false}),pendingVisitCountScopedForActor(actor,filters.assignedUserId,filters.q)]);
 const total=Object.values(counts).reduce((sum,count)=>sum+(count??0),0);
 const scopeParams=new URLSearchParams();if(q.q)scopeParams.set("q",q.q);if(q.assignedUserId)scopeParams.set("assignedUserId",q.assignedUserId);const scoped=(extra:Record<string,string>)=>{const p=new URLSearchParams(scopeParams);Object.entries(extra).forEach(([k,v])=>p.set(k,v));const s=p.toString();return `/workspace/leads${s?`?${s}`:""}`;};
 const leads=page.items;
 const visibleTitle=filters.stage?stageLabel(filters.stage):"All Leads";
 return <main className="leads-shell"><section className="leads-content"><WorkspacePageHeader title="Leads" backHref="/workspace"/>
  {q.deleted==="1"&&<p className="form-success" role="status">Lead deleted successfully.</p>}
  {<form className="lead-scope-filter">{isPending&&<input type="hidden" name="view" value="pending"/>}{q.stage&&<input type="hidden" name="stage" value={q.stage}/>}<input name="q" defaultValue={q.q} placeholder="Search name or phone"/>{user.salesRole!=="SALES"&&<select name="assignedUserId" defaultValue={q.assignedUserId||""}><option value="">All Employees</option>{scopeOptions.map(x=><option value={x.id} key={x.id}>{x.name} · {x.salesRole==="MANAGER"?(x.managerType==="MANAGER_ONLY"?"Manager Only":"Field Manager"):"Sales"}</option>)}</select>}<button>View</button></form>}
  <div className="lead-stage-summary"><Link className={!isPending&&!filters.stage?"active":""} href={scoped({})}><strong>{total}</strong><span>All Leads</span></Link><Link className={isPending?"active":""} href={scoped({view:"pending"})}><strong>{pendingCount}</strong><span>Pending</span></Link>{pipeline.map(x=><Link className={!isPending&&filters.stage===x.stage?"active":""} href={scoped({stage:x.stage})} key={x.stage}><strong>{counts[x.stage]??0}</strong><span>{x.label}</span></Link>)}</div>
  {!isPending&&user.salesRole==="SALES"&&<form className="lead-filters">{q.q&&<input type="hidden" name="q" value={q.q}/>}<select name="stage" defaultValue={q.stage||""}><option value="">All stages</option>{pipeline.map(x=><option value={x.stage} key={x.stage}>{x.label}</option>)}</select><button>Filter</button></form>}
  {isPending?<div className="pipeline"><section><h2>Pending <span>{pendingCount}</span></h2>{pending.items.length===0&&<p className="pending-empty">No check-ins are waiting for a phone number.</p>}{pending.items.map(v=><article key={v.id}><strong>{v.contactName||v.customer?.name||"Field prospect"}</strong><span>{v.user.name} · {formatIndiaDateTime(v.checkedInAt)}</span><span>{v.checkedOutAt?`Checked out ${formatIndiaDateTime(v.checkedOutAt)}`:"Checkout pending"}</span>{v.visitNotes&&<span>{v.visitNotes}</span>}<small>{v.checkInAddress||`${v.checkInLatitude.toFixed(5)}, ${v.checkInLongitude.toFixed(5)}`}</small>{v.photo&&<Link href={`/api/visit-photos/${v.id}`}>View photo / details</Link>}{(v.user.id===user.id||user.salesRole==="ADMIN"||user.salesRole==="PRIMARY_ADMIN"||(user.salesRole==="MANAGER"&&v.user.salesRole==="SALES"&&v.user.managerId===user.id))?<PendingPhoneForm visitId={v.id}/>:<Link href="/workspace/reports/check-ins">View check-in details</Link>}</article>)}</section></div>:
  <div className="pipeline"><section><h2>{visibleTitle} <span>{leads.length}</span></h2>{leads.length===0&&<p className="pending-empty">No leads match this filter.</p>}{leads.map(l=>{const visitCount=leadVisitCount(l);return <article key={l.id}><div className="lead-card-title-row"><Link className="lead-card-name" href={`/workspace/leads/${l.id}`}><strong>{l.title}</strong></Link>{l.phone&&<LeadCallAction leadId={l.id} title={l.title} phone={l.phone}/>}</div><span className="lead-stage-badge">{stageLabel(l.stage)}</span><span>{l.customer?.name||l.companyName||"Prospect"}</span><span>{l.assignedUser.name} · {l.source}</span><b>{visitCount} check-in / visit{visitCount===1?"":"s"}</b>{l.estimatedValue&&<b>{l.currencyCode} {l.estimatedValue.toFixed(2)}</b>}<Link href={`/workspace/leads/${l.id}/follow-up`}>+ Add Follow-up</Link><small>Updated {l.updatedAt.toLocaleDateString()}</small>{user.salesRole!=="PRIMARY_ADMIN"&&user.salesRole!=="ADMIN"&&l.assignedUser.id===user.id&&<Link className="add-checkin" href={`/workspace/check-ins?leadId=${l.id}`}>+ Add Check-in</Link>}{!isTelecallerDesignation(user.designation)&&<StageForm id={l.id} version={l.version} stage={l.stage}/>}</article>})}</section></div>}
 </section><ListPagination path="/workspace/leads" query={q} page={isPending?pending.page:page.page} hasMore={isPending?pending.hasMore:page.hasMore}/></main>;
}
