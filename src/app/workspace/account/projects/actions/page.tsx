import Link from "next/link";
import { AccountPageHeader, AccountCard } from "@/components/account/account-shell";
import { projectDashboard } from "@/lib/account/projects";
import { requireAccountWorkspace } from "@/lib/auth/authorization";
import { enabledModulesForCompany } from "@/lib/account/modules";
import { projectWorkflowCapabilities } from "@/lib/account/project-workflow-capabilities";
import { db } from "@/lib/db";
export default async function Page({searchParams}:{searchParams:Promise<{projectId?:string}>}) {
  const actor=await requireAccountWorkspace(),{rows}=await projectDashboard(),{projectId}=await searchParams;
  const [modules,company]=await Promise.all([enabledModulesForCompany(actor.companyId),db.company.findUniqueOrThrow({where:{id:actor.companyId},select:{productEdition:true}})]);
  const capabilities=projectWorkflowCapabilities(actor,company.productEdition,modules);
  const selected=rows.find(x=>x.id===projectId && !["COMPLETED","CLOSED","CANCELLED"].includes(x.status));
  const suffix=selected?`&projectId=${selected.id}`:"";
  const actions=[
    ["Advance / installment",`/workspace/account/transactions/money?type=CUSTOMER_ADVANCE${suffix}`,capabilities.paymentIn],
    ["Purchase materials",`/workspace/account/transactions/new?type=PURCHASE_BILL&purchaseFor=PROJECT${suffix}`,capabilities.purchase],
    ["Labour / other expense",`/workspace/account/expenses/new?context=project${suffix}`,capabilities.expense],
    ["Move leftover materials",`/workspace/account/projects/material?mode=project${suffix}`,capabilities.material],
    ["Extra job",selected?`/workspace/account/projects/${selected.id}/costing`:"",capabilities.extraJob],
    ["Profit / loss",selected?`/workspace/account/projects/${selected.id}/costing#report`:"",capabilities.report],
    ["Close Project",selected?`/workspace/account/projects/${selected.id}`:"",true],
  ] as const;
  return <main><AccountPageHeader title="Project Actions" subtitle="Record payments and costs, add extra work, move leftover materials and close the job." backHref="/workspace/account/projects"/>
    <AccountCard><form><label>Project <select name="projectId" defaultValue={selected?.id??""} required><option value="">Select Project</option>{rows.filter(x=>!["COMPLETED","CLOSED","CANCELLED"].includes(x.status)).map(x=><option value={x.id} key={x.id}>{x.projectNumber} · {x.name}</option>)}</select></label><button>Continue</button></form></AccountCard>
    <section className="account-quick-grid">{actions.filter(([, , allowed])=>allowed).map(([label,href])=>selected&&href?<Link className="account-card" href={href} key={label}>{label}</Link>:<span className="account-card disabled" key={label}>{label}<small>Select a Project first</small></span>)}</section>
  </main>;
}
