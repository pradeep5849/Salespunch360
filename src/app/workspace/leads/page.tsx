import Link from "next/link";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import {LeadStage} from "@prisma/client";
import {requireRole} from "@/lib/auth/authorization";
import {leadOptions,leadStageCounts,listLeads,listPendingVisitsForActor,pendingVisitCountForActor} from "@/lib/leads/service";
import {leadVisitCount} from "@/lib/leads/policy";
import {formatIndiaDateTime} from "@/lib/time/india";
import {PendingPhoneForm} from "./pending-phone-form";
import {StageForm} from "./stage-form";
import {DeleteLead} from "./delete-lead";

export const metadata={title:"Leads pipeline"};
const pipeline:{stage:LeadStage;label:string}[]=[
 {stage:"NEW",label:"Lead"},{stage:"QUALIFIED",label:"Qualified"},{stage:"PROPOSAL",label:"Prospecting"},
 {stage:"NEGOTIATION",label:"Quote Given"},{stage:"WON",label:"Won"},{stage:"LOST",label:"Lost"},
];
export default async function LeadsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireRole("COMPANY_ADMIN","MANAGER","SALES"),q=await searchParams,isPending=q.view==="pending";
 if(!user.companyId)throw new Error("Company access required");
 const actor={...user,companyId:user.companyId};
 const filters={stage:LeadStage[q.stage as keyof typeof LeadStage],assignedUserId:q.assignedUserId||undefined,q:q.q||undefined};
 const[leads,o,counts,pending,pendingCount]=await Promise.all([listLeads(filters),leadOptions(),leadStageCounts(filters.assignedUserId,filters.q),isPending?listPendingVisitsForActor(actor):Promise.resolve([]),pendingVisitCountForActor(actor)]);
 const total=Object.values(counts).reduce((sum,count)=>sum+(count??0),0);
 const scopeParams=new URLSearchParams();if(q.q)scopeParams.set("q",q.q);if(q.assignedUserId)scopeParams.set("assignedUserId",q.assignedUserId);const scoped=(extra:Record<string,string>)=>{const p=new URLSearchParams(scopeParams);Object.entries(extra).forEach(([k,v])=>p.set(k,v));const s=p.toString();return `/workspace/leads${s?`?${s}`:""}`;};
 return <main className="leads-shell"><section className="leads-content"><WorkspacePageHeader title="Leads" backHref="/workspace"/>
  {user.role!=="SALES"&&<form className="lead-scope-filter"><input name="q" defaultValue={q.q} placeholder="Search name or phone"/><select name="assignedUserId" defaultValue={q.assignedUserId||""}><option value="">All Employees</option>{o.users.map(x=><option value={x.id} key={x.id}>{x.name} · {x.role==="MANAGER"?"Manager":"Sales"}</option>)}</select><button>View</button></form>}
  <div className="lead-stage-summary"><Link className={!isPending&&!filters.stage?"active":""} href={scoped({})}><strong>{total}</strong><span>All Leads</span></Link><Link className={isPending?"active":""} href={scoped({view:"pending"})}><strong>{pendingCount}</strong><span>Pending</span></Link>{pipeline.map(x=><Link className={!isPending&&filters.stage===x.stage?"active":""} href={scoped({stage:x.stage})} key={x.stage}><strong>{counts[x.stage]??0}</strong><span>{x.label}</span></Link>)}</div>
  {!isPending&&user.role==="SALES"&&<form className="lead-filters"><select name="stage" defaultValue={q.stage||""}><option value="">All stages</option>{pipeline.map(x=><option value={x.stage} key={x.stage}>{x.label}</option>)}</select><button>Filter</button></form>}
  {isPending?<div className="pipeline"><section><h2>Pending <span>{pendingCount}</span></h2>{pending.length===0&&<p className="pending-empty">No check-ins are waiting for a phone number.</p>}{pending.map(v=><article key={v.id}><strong>{v.contactName||v.customer?.name||"Field prospect"}</strong><span>{v.user.name} · {formatIndiaDateTime(v.checkedInAt)}</span><span>{v.checkedOutAt?`Checked out ${formatIndiaDateTime(v.checkedOutAt)}`:"Checkout pending"}</span>{v.visitNotes&&<span>{v.visitNotes}</span>}<small>{v.checkInAddress||`${v.checkInLatitude.toFixed(5)}, ${v.checkInLongitude.toFixed(5)}`}</small>{v.photo&&<Link href={`/api/visit-photos/${v.id}`}>View photo / details</Link>}{v.user.id===user.id?<PendingPhoneForm visitId={v.id}/>:<Link href="/workspace/check-ins">View check-in details</Link>}</article>)}</section></div>:
  <div className="pipeline">{(filters.stage?pipeline.filter(x=>x.stage===filters.stage):pipeline).map(({stage,label})=><section key={stage}><h2>{label} <span>{counts[stage]??0}</span></h2>{leads.filter(l=>l.stage===stage).map(l=>{const visitCount=leadVisitCount(l);return <article key={l.id}><Link href={`/workspace/leads/${l.id}`}><strong>{l.title}</strong></Link><span>{l.customer?.name||l.companyName||"Prospect"}</span><span>{l.assignedUser.name} · {l.source}</span><b>{visitCount} check-in / visit{visitCount===1?"":"s"}</b>{l.estimatedValue&&<b>{l.currencyCode} {l.estimatedValue.toFixed(2)}</b>}<Link href={`/workspace/leads/${l.id}#add-follow-up`}>+ Add Follow-up</Link><small>Updated {l.updatedAt.toLocaleDateString()}</small>{user.role!=="COMPANY_ADMIN"&&l.assignedUser.id===user.id&&<Link className="add-checkin" href={`/workspace/check-ins?leadId=${l.id}`}>+ Add Check-in</Link>}{(user.role==="COMPANY_ADMIN"||l.assignedUser.id===user.id)&&<DeleteLead leadId={l.id}/>}<StageForm id={l.id} version={l.version} stage={stage}/></article>})}</section>)}</div>}
 </section></main>;
}
