import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
import {requirePermission} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import {createCustomerAction} from "@/app/actions/customers";

export default async function NewCustomerPage(){
 const user=await requirePermission("SALES_CUSTOMERS");
 if(!user.companyId||(user.salesRole!=="PRIMARY_ADMIN"&&user.salesRole!=="ADMIN"))throw new Error("Company access required");
 const assignees=await db.user.findMany({where:{companyId:user.companyId,isActive:true,salesAccessActive:true,OR:[{salesRole:"SALES"},{salesRole:"MANAGER",managerType:"FIELD_MANAGER"}]},select:{id:true,name:true,salesRole:true},orderBy:{name:"asc"}});
 return <main className="customers-shell"><section className="customers-content narrow-content"><WorkspacePageHeader title="New Customer" backHref="/workspace/customers"/><form action={createCustomerAction} className="employee-form customer-form"><label className="field">Customer Name<input name="name" required maxLength={160}/></label><label className="field">Phone Number<input name="phone" required inputMode="tel"/></label><label className="field">Assign To<select name="assignedUserId" defaultValue=""><option value="">Not assigned yet</option>{assignees.map(u=><option key={u.id} value={u.id}>{u.name} · {u.salesRole==="MANAGER"?"Field Manager":"Sales"}</option>)}</select></label><button>Create</button></form></section></main>;
}
