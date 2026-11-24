import {pageWindow,pageResult} from "@/lib/pagination";
import {ListPagination} from "@/components/workspace/list-pagination";
import type { Metadata } from "next";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { requirePermission } from "@/lib/auth/authorization";
import { searchCustomersForCompany } from "@/lib/customers/service";
import { CustomerManager } from "./customer-manager";
import { db } from "@/lib/db";
import {operationalBranchContext} from "@/lib/branches/operational-scope";

export const metadata: Metadata = { title: "Customers" };
export default async function CustomersPage({searchParams}:{searchParams:Promise<{page?:string;q?:string}>}) {
  const query=await searchParams,window=pageWindow({page:query.page,pageSize:50}),q=query.q?.trim().slice(0,100)??"";
  const user=await requirePermission("SALES_CUSTOMERS");
  if(!user.companyId)throw new Error("Company access required");
  const branches=await operationalBranchContext({...user,companyId:user.companyId});
  const canManage=user.salesRole==="PRIMARY_ADMIN"||user.salesRole==="ADMIN";
  const loaded=await searchCustomersForCompany(user.companyId,q,canManage?null:user.id,branches.branchIds,window.page,window.take);
  const result=pageResult(loaded,{page:window.page,pageSize:window.pageSize}),unassigned=result.items;
  const assignees=user.salesRole==="PRIMARY_ADMIN"||user.salesRole==="ADMIN"?await db.user.findMany({where:{companyId:user.companyId,isActive:true,salesAccessActive:true,OR:[{salesRole:"SALES"},{salesRole:"MANAGER",managerType:"FIELD_MANAGER"}]},select:{id:true,name:true,salesRole:true,branchAccessScope:true,branchAccesses:{select:{branchId:true}}},orderBy:[{name:"asc"},{id:"asc"}]}):[];
  return <main className="customers-shell"><section className="customers-content"><WorkspacePageHeader title="Customers" backHref="/workspace"/><form method="get"><label>Search Lead<input name="q" defaultValue={q} maxLength={100}/></label><button>Search</button></form><CustomerManager customers={unassigned} canManage={user.salesRole==="PRIMARY_ADMIN"||user.salesRole==="ADMIN"} assignees={assignees}/><ListPagination path="/workspace/customers" query={{q}} page={result.page} hasMore={result.hasMore}/></section></main>;
}
