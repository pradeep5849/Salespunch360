import type { Metadata } from "next";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { requirePermission } from "@/lib/auth/authorization";
import { searchCustomersForCompany,searchCustomers } from "@/lib/customers/service";
import { CustomerManager } from "./customer-manager";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Customers" };
export default async function CustomersPage() {
  const user=await requirePermission("SALES_CUSTOMERS");
  if(!user.companyId)throw new Error("Company access required");
  const customers=user.salesRole==="PRIMARY_ADMIN"||user.salesRole==="ADMIN"
    ? await searchCustomersForCompany(user.companyId,"",null)
    : await searchCustomers();
  const unassigned=user.salesRole==="PRIMARY_ADMIN"||user.salesRole==="ADMIN"?customers.filter(c=>!c.assignedUserId):customers;
  const assignees=user.salesRole==="PRIMARY_ADMIN"||user.salesRole==="ADMIN"?await db.user.findMany({where:{companyId:user.companyId,isActive:true,salesAccessActive:true,OR:[{salesRole:"SALES"},{salesRole:"MANAGER",managerType:"FIELD_MANAGER"}]},select:{id:true,name:true,salesRole:true},orderBy:{name:"asc"}}):[];
  return <main className="customers-shell"><section className="customers-content"><WorkspacePageHeader title="Customers" backHref="/workspace"/><CustomerManager customers={unassigned} canManage={user.salesRole==="PRIMARY_ADMIN"||user.salesRole==="ADMIN"} assignees={assignees}/></section></main>;
}
