import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/authorization";
import { searchCustomers } from "@/lib/customers/service";
import { CustomerManager } from "./customer-manager";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Customers" };
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser(); const q = (await searchParams).q ?? ""; const customers = await searchCustomers(q); const assignees=user.role==="COMPANY_ADMIN"&&user.companyId?await db.user.findMany({where:{companyId:user.companyId,isActive:true,role:{in:["MANAGER","SALES"]}},select:{id:true,name:true,role:true},orderBy:{name:"asc"}}):[];
  return <main className="customers-shell"><header className="employees-header"><Link href="/workspace">← Workspace</Link><div className="logo"><span>SP</span> SalesPunch360</div></header><section className="customers-content"><p className="eyebrow">Company customer directory</p><h1>Customers</h1><form className="customer-search"><input name="q" defaultValue={q} placeholder="Search customers or contacts"/><button>Search</button></form><CustomerManager customers={customers} canManage={user.role === "COMPANY_ADMIN"} assignees={assignees} /></section></main>;
}
