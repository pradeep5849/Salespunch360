import Link from "next/link";
import {LeadStage} from "@prisma/client";
import {requireRole} from "@/lib/auth/authorization";
import {leadOptions,leadStageCounts,listLeads} from "@/lib/leads/service";
import {LeadForm} from "./lead-form";
import {StageForm} from "./stage-form";
import {DeleteLead} from "./delete-lead";

export const metadata={title:"Leads pipeline"};
const pipeline:{stage:LeadStage;label:string}[]=[
 {stage:"NEW",label:"Lead"},{stage:"QUALIFIED",label:"Follow-up"},{stage:"PROPOSAL",label:"Prospecting"},
 {stage:"NEGOTIATION",label:"Quote Given"},{stage:"WON",label:"Won"},{stage:"LOST",label:"Lost"},
];
export default async function LeadsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireRole("COMPANY_ADMIN","MANAGER","SALES"),q=await searchParams;
 const filters={stage:LeadStage[q.stage as keyof typeof LeadStage],assignedUserId:q.assignedUserId||undefined,followUp:q.followUp as "overdue"|"today"|"upcoming"|undefined,q:q.q||undefined};
 const[leads,o,counts]=await Promise.all([listLeads(filters),leadOptions(),leadStageCounts()]);
 const total=Object.values(counts).reduce((sum,count)=>sum+(count??0),0);
 return <main className="leads-shell"><header className="employees-header"><Link href="/workspace">← Workspace</Link><div className="logo"><span>SP</span> SalesPunch360</div></header><section className="leads-content"><p className="eyebrow">Tenant-secure sales pipeline</p><h1>Leads</h1>
  <div className="lead-stage-summary"><article><strong>{total}</strong><span>Total Leads</span></article>{pipeline.map(x=><article key={x.stage}><strong>{counts[x.stage]??0}</strong><span>{x.label}</span></article>)}</div>
  {(user.role!=="SALES"||q.visitId)&&<LeadForm users={o.users} customers={o.customers} visitId={q.visitId}/>}<form className="lead-filters"><input name="q" defaultValue={q.q} placeholder="Search lead, customer, prospect"/><select name="stage" defaultValue={q.stage||""}><option value="">All stages</option>{pipeline.map(x=><option value={x.stage} key={x.stage}>{x.label}</option>)}</select>{user.role!=="SALES"&&<select name="assignedUserId" defaultValue={q.assignedUserId||""}><option value="">All permitted assignees</option>{o.users.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select>}<select name="followUp" defaultValue={q.followUp||""}><option value="">Any follow-up</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="upcoming">Upcoming</option></select><button>Filter</button></form>
  <div className="pipeline">{pipeline.map(({stage,label})=><section key={stage}><h2>{label} <span>{counts[stage]??0}</span></h2>{leads.filter(l=>l.stage===stage).map(l=><article key={l.id}><Link href={`/workspace/leads/${l.id}`}><strong>{l.title}</strong></Link><span>{l.customer?.name||l.companyName||"Prospect"}</span><span>{l.assignedUser.name} · {l.source}</span><b>{l.customer?._count.visits??0} check-in / visit{l.customer?._count.visits===1?"":"s"}</b>{l.estimatedValue&&<b>{l.currencyCode} {l.estimatedValue.toFixed(2)}</b>}<span>{l.followUpAt?`Follow up ${l.followUpAt.toLocaleString()}`:"No follow-up"}</span><small>Updated {l.updatedAt.toLocaleDateString()}</small>{user.role!=="COMPANY_ADMIN"&&l.assignedUser.id===user.id&&<Link className="add-checkin" href={`/workspace/check-ins?leadId=${l.id}`}>+ Add Check-in</Link>}{(user.role==="COMPANY_ADMIN"||l.assignedUser.id===user.id)&&<DeleteLead leadId={l.id}/>}<StageForm id={l.id} version={l.version} stage={stage}/></article>)}</section>)}</div>
 </section></main>;
}
