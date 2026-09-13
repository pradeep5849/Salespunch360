import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
import {requirePermission} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import {operationalBranchContext} from "@/lib/branches/operational-scope";
import {NewCustomerForm} from "./new-customer-form";

export default async function NewCustomerPage(){
 const user=await requirePermission("SALES_CUSTOMERS");
 if(!user.companyId||(user.salesRole!=="PRIMARY_ADMIN"&&user.salesRole!=="ADMIN"))throw new Error("Company access required");
 const scope=await operationalBranchContext({...user,companyId:user.companyId}),[branches,assignees]=await Promise.all([db.branch.findMany({where:{companyId:user.companyId,id:{in:scope.branchIds},isActive:true},select:{id:true,name:true},orderBy:[{isPrimary:"desc"},{name:"asc"},{id:"asc"}]}),db.user.findMany({where:{companyId:user.companyId,isActive:true,salesAccessActive:true,OR:[{salesRole:"SALES"},{salesRole:"MANAGER",managerType:"FIELD_MANAGER"}]},select:{id:true,name:true,salesRole:true,branchAccessScope:true,branchAccesses:{select:{branchId:true}}},orderBy:[{name:"asc"},{id:"asc"}]})]);
 return <main className="customers-shell"><section className="customers-content narrow-content"><WorkspacePageHeader title="New Customer" backHref="/workspace/customers"/><NewCustomerForm branches={branches} assignees={assignees}/></section></main>;
}
