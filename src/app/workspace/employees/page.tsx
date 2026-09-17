import Link from "next/link";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { getEmployeeManagementContext } from "@/lib/employees/service";
import { getProductUserManagementContext } from "@/lib/users/product-user-management";
import { listAdditionalAdmins } from "@/lib/users/additional-admin";
import { effectiveEntitlement } from "@/lib/billing/entitlement";
import { webWorkspaceContext } from "@/lib/auth/web-workspace";
import { accountGroups, accountRoleLabel, salesGroups, salesRoleLabel, type DirectoryUser } from "./directory-policy";

const accountRoles = ["ACCOUNT_ADMIN", "ACCOUNTANT", "PROJECT_MANAGER", "DATA_ENTRY"] as const;

type GroupProps = { title:string; users:DirectoryUser[]; empty:string; addHref?:string; addLabel?:string; canManage:boolean; canAdd:boolean; domain:"sales"|"account" };
export function EmployeeCard({user,domain,canManage}:{user:DirectoryUser;domain:"sales"|"account";canManage:boolean}) {
  const active=user.isActive&&(domain==="sales"?user.salesAccessActive:user.accountAccessActive);
  const label=domain==="sales"?salesRoleLabel(user):accountRoleLabel(user.accountRole!);
  return <article className={`employee-card ${active?"":"inactive"}`}><div className="employee-summary"><div className="avatar">{user.name[0]?.toUpperCase()}</div><div className="employee-identity"><h3>{user.name}</h3><p>{user.email}</p><p>{label} · {active?"Active":"Inactive"}</p></div></div>{canManage&&<Link href={`/workspace/employees/${domain}/edit/${user.id}`}>Edit User</Link>}</article>;
}
export function EmployeeGroup({title,users,empty,addHref,addLabel,canManage,canAdd,domain}:GroupProps) {
  return <section className="billing-card"><h2>{title}</h2><div className="employee-list">{users.map(user=><EmployeeCard key={user.id} user={user} domain={domain} canManage={canManage}/>)}{!users.length&&<p className="muted">{empty}</p>}</div>{canAdd&&addHref&&<p><Link className="primary-button" href={addHref}>{addLabel}</Link></p>}</section>;
}
export default async function EmployeesPage({searchParams}:{searchParams:Promise<{domain?:string;filter?:string}>}) {
  const context=await getProductUserManagementContext(),params=await searchParams;
  const workspace=await webWorkspaceContext(context.actor);
  const domain=workspace?.effectiveWorkspace==="ACCOUNT"||!context.canManageSalesUsers?"account":"sales";
  if(domain==="account") {
    const groups=accountGroups(context.users as DirectoryUser[]),filter=(params.filter??"all").toLowerCase();
    return <main className="employees-shell"><section className="employees-content"><WorkspacePageHeader title="Account Employees" backHref="/workspace/account"/><nav className="employee-filters"><Link href="/workspace/employees">All</Link><Link href="/workspace/employees?filter=inactive">Inactive</Link></nav><div className="account-role-stats">{accountRoles.map(role=><div key={role}><strong>{context.accountUsage[role]} / {context.accountLimits[role]}</strong><span>{accountRoleLabel(role)} · {Math.max(0,context.accountLimits[role]-context.accountUsage[role])} available</span></div>)}</div>{filter==="inactive"?<EmployeeGroup title="Inactive Account Employees" users={groups.inactive} empty="No inactive users." canManage={context.canManageAccountUsers} canAdd={false} domain="account"/>:accountRoles.map(role=><EmployeeGroup key={role} title={`${accountRoleLabel(role)}s`} users={groups[role]} empty={`No ${accountRoleLabel(role)}s added.`} canManage={context.canManageAccountUsers} canAdd={context.canManageAccountUsers&&context.accountUsage[role]<context.accountLimits[role]} addHref={`/workspace/employees/account/new/${role.toLowerCase().replaceAll("_","-")}`} addLabel={`Add ${accountRoleLabel(role)}`} domain="account"/>)}</section></main>;
  }
  const [employeeContext,admins,seats]=await Promise.all([getEmployeeManagementContext(),listAdditionalAdmins(),effectiveEntitlement(context.actor.companyId!)]);
  const all=[...admins.map(user=>({...user,salesRole:"ADMIN" as const,managerType:null})),...employeeContext.employees] as DirectoryUser[];
  const groups=salesGroups(all),filter=(params.filter??"all").toLowerCase(),canManage=context.actor.salesRole==="PRIMARY_ADMIN";
  const usage={ADMIN:seats.adminUsage,MANAGER:seats.managerUsage,SALES:seats.salesUsage},limits={ADMIN:seats.adminLimit,MANAGER:seats.managerLimit,SALES:seats.salesLimit};
  const group=(title:string,users:DirectoryUser[],role:"ADMIN"|"MANAGER"|"SALES",href:string,label:string)=><EmployeeGroup title={title} users={users} empty={`No ${title} added.`} canManage={canManage} canAdd={canManage&&usage[role]<limits[role]} addHref={href} addLabel={label} domain="sales"/>;
  return <main className="employees-shell"><section className="employees-content"><WorkspacePageHeader title="Sales Employees" backHref="/workspace"/><div className="employee-stats employee-stats-four"><div><strong>{seats.adminUsage} / {seats.adminLimit}</strong><span>Active Admins</span></div><div><strong>{seats.managerUsage} / {seats.managerLimit}</strong><span>Active Managers</span></div><div><strong>{seats.salesUsage} / {seats.salesLimit}</strong><span>Active Sales</span></div><div><strong>{groups.inactive.length}</strong><span>Inactive</span></div></div><nav className="employee-filters">{["all","administrators","managers","sales","active","inactive"].map(item=><Link key={item} href={item==="all"?"/workspace/employees":`/workspace/employees?filter=${item}`}>{item[0].toUpperCase()+item.slice(1)}</Link>)}</nav>{filter==="administrators"?group("Additional Admins",groups.admins,"ADMIN","/workspace/employees/sales/new/additional-admin","Add Additional Admin"):filter==="managers"?group("Managers",[...groups.salesManagers,...groups.officeManagers],"MANAGER","/workspace/employees/sales/new/manager","Add Manager"):filter==="sales"?group("Sales Employees",groups.sales,"SALES","/workspace/employees/sales/new/sales","Add Sales Employee"):filter==="active"?<EmployeeGroup title="Active Employees" users={groups.active} empty="No active employees." canManage={canManage} canAdd={false} domain="sales"/>:filter==="inactive"?<EmployeeGroup title="Inactive Employees" users={groups.inactive} empty="No inactive users." canManage={canManage} canAdd={false} domain="sales"/>:<>{group("Additional Admins",groups.admins,"ADMIN","/workspace/employees/sales/new/additional-admin","Add Additional Admin")}{group("Sales Managers",groups.salesManagers,"MANAGER","/workspace/employees/sales/new/manager","Add Manager")}<EmployeeGroup title="Office Managers" users={groups.officeManagers} empty="No Office Managers added." canManage={canManage} canAdd={false} domain="sales"/>{group("Sales Employees",groups.sales,"SALES","/workspace/employees/sales/new/sales","Add Sales Employee")}</>}</section></main>;
}