"use client";
import { useActionState, useState } from "react";
import type { AccountRole, ManagerType, ProductEdition, SalesRole } from "@prisma/client";
import { manageProductUser, type ProductUserState } from "@/app/actions/product-users";

type User = { id:string;name:string;email:string;isActive:boolean;salesRole:SalesRole|null;accountRole:AccountRole|null;managerType:ManagerType|null;managerId:string|null;salesAccessActive:boolean;accountAccessActive:boolean;branchAccessScope:"ALL_BRANCHES"|"SELECTED_BRANCHES";branchAccesses:{branchId:string}[] };
type Branch = { id:string;name:string;code:string;isPrimary:boolean };
// Additional Sales Admin has one stronger Primary-Admin-only management path.
const salesEditRoles = [["", "No Sales role"], ["MANAGER", "Manager"], ["SALES", "Sales"]] as const;
const accountRoles = [["", "No Account role"], ["ACCOUNT_ADMIN", "Account Admin"], ["ACCOUNTANT", "Accountant"], ["PROJECT_MANAGER", "Project Manager"], ["DATA_ENTRY", "Data Entry"]] as const;

function RoleFields({ edition, managers, user }: { edition:ProductEdition;managers:User[];user?:User }) {
  const sales = edition !== "SALESPUNCH360_ACCOUNT", account = edition !== "SALESPUNCH360";
  const [selectedSales, setSelectedSales] = useState(user?.salesRole ?? "");
  return <>
    {sales && <><label>Sales role<select name="salesRole" value={selectedSales} onChange={(event)=>setSelectedSales(event.target.value as SalesRole|"")}>{salesEditRoles.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>{selectedSales === "MANAGER" && <label>Manager type<select name="managerType" defaultValue={user?.managerType ?? "FIELD_MANAGER"}><option value="FIELD_MANAGER">Field Manager</option><option value="MANAGER_ONLY">Manager Only</option></select></label>}{selectedSales === "SALES" && <label>Assigned Manager<select name="managerId" defaultValue={user?.managerId ?? ""}><option value="">No manager</option>{managers.map(manager=><option value={manager.id} key={manager.id}>{manager.name}</option>)}</select></label>}</>}
    {!sales && <input type="hidden" name="salesRole" value=""/>}
    {account && <label>Account role<select name="accountRole" defaultValue={user?.accountRole ?? ""}>{accountRoles.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>}
    {!account && <input type="hidden" name="accountRole" value=""/>}
    {selectedSales !== "MANAGER" && <input type="hidden" name="managerType" value=""/>}{selectedSales !== "SALES" && <input type="hidden" name="managerId" value=""/>}
  </>;
}

function BranchFields({ branches, user }: { branches:Branch[];user?:User }) { return <><label>Branch scope<select name="branchAccessScope" defaultValue={user?.branchAccessScope ?? "ALL_BRANCHES"}><option value="ALL_BRANCHES">All Branches</option><option value="SELECTED_BRANCHES">Selected Branches</option></select></label><fieldset><legend>Selected Branches</legend>{branches.map(branch=><label key={branch.id}><input type="checkbox" name="branchIds" value={branch.id} defaultChecked={user?.branchAccesses.some(access=>access.branchId===branch.id)}/>{branch.name} ({branch.code})</label>)}</fieldset></>; }

export function ProductUserManager({ edition, users, branches }: { edition:ProductEdition;users:User[];branches:Branch[] }) {
  const [state, action, pending] = useActionState<ProductUserState,FormData>(manageProductUser, {}), [creating,setCreating]=useState(false);
  const managers=users.filter(user=>user.salesRole==="MANAGER"&&user.salesAccessActive&&user.isActive);
  const hasSales=edition!=="SALESPUNCH360_ACCOUNT",hasAccount=edition!=="SALESPUNCH360";
  return <section className="employee-list"><header className="employee-actions"><div><h2>Company users</h2><p className="muted">Roles shown are limited by {edition}.</p></div><button onClick={()=>setCreating(value=>!value)}>Add user</button></header>
    {state.error&&<p className="form-error">{state.error}</p>}{state.success&&<p className="form-success">{state.success}</p>}
    {creating&&<form action={action} className="employee-form create-form"><input type="hidden" name="operation" value="create"/><h3>Create user</h3><label>Name<input name="name" required/></label><label>Email<input name="email" type="email" required/></label><RoleFields edition={edition} managers={managers}/><BranchFields branches={branches}/><label>Password<input name="password" type="password" minLength={12} required/></label><label>Confirm password<input name="confirmPassword" type="password" minLength={12} required/></label><button disabled={pending}>Create user</button></form>}
    {users.map(user=><article className="employee-card" key={user.id}><div className="employee-summary"><div className="employee-identity"><h2>{user.name}</h2><p>{user.email}</p><p>{hasSales&&(user.salesRole ? `Sales: ${user.salesRole}${user.managerType?` (${user.managerType})`:""}` : "No Sales role")}{hasSales&&hasAccount?" · ":""}{hasAccount&&(user.accountRole ? `Account: ${user.accountRole}` : "No Account role")}</p></div></div><details><summary>Manage roles and access</summary><form action={action} className="employee-form"><input type="hidden" name="operation" value="edit"/><input type="hidden" name="userId" value={user.id}/><label>Name<input name="name" defaultValue={user.name} required/></label><label>Email<input name="email" type="email" defaultValue={user.email} required/></label><RoleFields edition={edition} managers={managers.filter(manager=>manager.id!==user.id)} user={user}/>{hasSales?<label><input type="checkbox" name="salesAccessActive" defaultChecked={user.salesAccessActive}/>Sales workspace active</label>:<input type="hidden" name="salesAccessActive" value=""/>}{hasAccount?<label><input type="checkbox" name="accountAccessActive" defaultChecked={user.accountAccessActive}/>Account workspace active</label>:<input type="hidden" name="accountAccessActive" value=""/>}<BranchFields branches={branches} user={user}/><button disabled={pending}>Save roles and access</button></form></details></article>)}
  </section>;
}
