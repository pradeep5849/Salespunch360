import Link from "next/link";
import { manageEmployeeForm } from "@/app/actions/employees";
import { manageAdditionalAdmin } from "@/app/actions/additional-admins";
import { getProductUserManagementContext } from "@/lib/users/product-user-management";
import { getEmployeeManagementContext } from "@/lib/employees/service";
import { effectiveEntitlement } from "@/lib/billing/entitlement";
import { ManagerCreateForm } from "./manager-create-form";

export default async function Page({params}:{params:Promise<{kind:string}>}) {
  const {kind}=await params,ctx=await getProductUserManagementContext();
  if(ctx.actor.salesRole!=="PRIMARY_ADMIN"||!["additional-admin","manager","sales"].includes(kind))throw new Error("Not authorized");
  const seats=await effectiveEntitlement(ctx.actor.companyId!),additional=kind==="additional-admin",manager=kind==="manager",usage=additional?seats.adminUsage:manager?seats.managerUsage:seats.salesUsage,limit=additional?seats.adminLimit:manager?seats.managerLimit:seats.salesLimit;
  if(usage>=limit)return <main className="employees-shell"><section className="employees-content"><h1>No seat available</h1><p>No seat available. Purchase additional capacity to add another user.</p><Link href="/workspace/employees">Back to Sales Employees</Link></section></main>;
  const employeeContext=await getEmployeeManagementContext(),managers=employeeContext.employees.filter(user=>user.salesRole==="MANAGER"&&user.isActive&&user.salesAccessActive);
  if(manager)return <main className="employees-shell"><section className="employees-content"><h1>Add Manager</h1><ManagerCreateForm branches={ctx.branches}/></section></main>;
  const action=additional?manageAdditionalAdmin:manageEmployeeForm;
  return <main className="employees-shell"><section className="employees-content"><h1>Add {additional?"Additional Admin":"Sales Employee"}</h1><form action={action as never} className="employee-form"><input type="hidden" name="returnTo" value="/workspace/employees"/><input type="hidden" name="operation" value={additional?"create":"create-sales"}/><label>Name<input name="name" required/></label><label>Email<input name="email" type="email" required/></label><label>Phone<input name="phone"/></label>{!additional&&<><label>Employee code<input name="employeeCode"/></label><label>Designation<input name="designation"/></label><label>Date of Joining<input name="dateOfJoining" type="date"/></label><label>Branch scope<select name="branchAccessScope" defaultValue="ALL_BRANCHES"><option value="ALL_BRANCHES">All Branches</option><option value="SELECTED_BRANCHES">Selected Branches</option></select></label><fieldset><legend>Selected Branches</legend>{ctx.branches.map(branch=><label key={branch.id}><input type="checkbox" name="branchIds" value={branch.id}/>{branch.name} ({branch.code})</label>)}</fieldset></>}{kind==="sales"&&employeeContext.teamStructure!=="SALES_ONLY"&&<label>Assigned Manager<select name="managerId" defaultValue=""><option value="">No manager</option>{managers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<label>Password<input name="password" type="password" minLength={12} required/></label><label>Confirm password<input name="confirmPassword" type="password" minLength={12} required/></label><button>Save</button> <Link href="/workspace/employees">Cancel</Link></form></section></main>;
}
