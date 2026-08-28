import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/authorization";
import { searchCustomers } from "@/lib/customers/service";
import { getOwnPendingVisits, getVisibleRecentVisits } from "@/lib/visits/service";
import { VisitWorkspace } from "./visit-workspace";

export const metadata:Metadata={title:"Customer visits"};
export default async function CheckInsPage(){const user=await requireUser();const employee=user.role==="MANAGER"||user.role==="SALES";const customers=employee?await searchCustomers():[];const pending=employee?await getOwnPendingVisits():[];const recent=user.role==="COMPANY_ADMIN"||user.role==="MANAGER"?await getVisibleRecentVisits():[];return <main className="visits-shell"><header className="employees-header"><Link href="/workspace">← Workspace</Link><div className="logo"><span>SP</span> SalesPunch360</div></header><section className="visits-content"><p className="eyebrow">Field customer activity</p><h1>Customer visits</h1>{employee&&<VisitWorkspace customers={customers} pending={pending}/>} {recent.length>0&&<section className="recent-visits"><h2>Current and recent visits</h2>{recent.map(v=><article key={v.id}><div><strong>{v.user.name}</strong><span>{v.user.role} · {v.customer.name}</span></div><div><strong>{v.checkedOutAt?"Completed":"Pending checkout"}</strong><span>{v.checkedInAt.toLocaleString("en-US",{timeZone:"UTC"})} UTC{v.checkoutSentiment?` · ${v.checkoutSentiment}`:""}</span></div></article>)}</section>}</section></main>}
