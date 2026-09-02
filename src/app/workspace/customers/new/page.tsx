import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
import {requireRole} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import {createCustomerAction} from "@/app/actions/customers";

export default async function NewCustomerPage(){
 const user=await requireRole("COMPANY_ADMIN");
 if(!user.companyId)throw new Error("Company access required");
 const assignees=await db.user.findMany({where:{companyId:user.companyId,isActive:true,OR:[{role:"SALES"},{role:"MANAGER",managerType:"FIELD_MANAGER"}]},select:{id:true,name:true,role:true},orderBy:{name:"asc"}});
 return <main className="customers-shell"><section className="customers-content narrow-content"><WorkspacePageHeader title="New Customer" backHref="/workspace/customers"/><form action={createCustomerAction} className="employee-form customer-form"><label className="field">Customer Name<input name="name" required maxLength={160}/></label><label className="field">Phone Number<input name="phone" required inputMode="tel"/></label><label className="field">Assign To<select name="assignedUserId" defaultValue=""><option value="">Not assigned yet</option>{assignees.map(u=><option key={u.id} value={u.id}>{u.name} · {u.role==="MANAGER"?"Field Manager":"Sales"}</option>)}</select></label><button>Create Customer</button></form></section></main>;
}
