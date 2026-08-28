import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/authorization";
import { searchCustomers } from "@/lib/customers/service";
import { CustomerManager } from "./customer-manager";

export const metadata: Metadata = { title: "Customers" };
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser(); const q = (await searchParams).q ?? ""; const customers = await searchCustomers(q);
  return <main className="customers-shell"><header className="employees-header"><Link href="/workspace">← Workspace</Link><div className="logo"><span>SP</span> SalesPunch360</div></header><section className="customers-content"><p className="eyebrow">Company customer directory</p><h1>Customers</h1><form className="customer-search"><input name="q" defaultValue={q} placeholder="Search customers or contacts"/><button>Search</button></form><CustomerManager customers={customers} canManage={user.role === "COMPANY_ADMIN"} /></section></main>;
}
