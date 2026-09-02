import type { Metadata } from "next";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { requireUser } from "@/lib/auth/authorization";
import { searchCustomersForCompany,searchCustomers } from "@/lib/customers/service";
import { CustomerManager } from "./customer-manager";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Customers" };
export default async function CustomersPage() {
  const user=await requireUser();
  if(!user.companyId)throw new Error("Company access required");
  const customers=user.role==="COMPANY_ADMIN"
    ? await searchCustomersForCompany(user.companyId,"",null as unknown as string)
    : await searchCustomers();
  const unassigned=user.role==="COMPANY_ADMIN"?customers.filter(c=>!c.assignedUserId):customers;
  const assignees=user.role==="COMPANY_ADMIN"?await db.user.findMany({where:{companyId:user.companyId,isActive:true,OR:[{role:"SALES"},{role:"MANAGER",managerType:"FIELD_MANAGER"}]},select:{id:true,name:true,role:true},orderBy:{name:"asc"}}):[];
  return <main className="customers-shell"><section className="customers-content"><WorkspacePageHeader title="Customers" backHref="/workspace"/><CustomerManager customers={unassigned} canManage={user.role==="COMPANY_ADMIN"} assignees={assignees}/></section></main>;
}
