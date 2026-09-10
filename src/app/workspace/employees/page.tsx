import type { Metadata } from "next";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import Link from "next/link";
import { getEmployeeManagementContext } from "@/lib/employees/service";
import { EmployeeManager } from "./employee-manager";
import { requirePermission } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { profileComplete } from "@/lib/company/profile";
import type { SalesRole } from "@prisma/client";
import {listBranchAssignmentOptions} from '@/lib/branches/assignment';
import {listAdditionalAdmins} from '@/lib/users/additional-admin';
import {listPrimaryAdminTransferCandidates} from '@/lib/users/primary-admin';
import {manageAdditionalAdmin} from '@/app/actions/additional-admins';
import {transferPrimaryAdminAction} from '@/app/actions/primary-admin';
import { canManageEmployeeTravel, isManagerEmployee, isSalesEmployee } from "./presentation";
import { getProductUserManagementContext } from "@/lib/users/product-user-management";
import { ProductUserManager } from "./product-user-manager";

export const metadata: Metadata = { title: "Employees" };

const filters = ["ALL", "MANAGERS", "SALES", "ACTIVE", "INACTIVE"] as const;

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const productContext = await getProductUserManagementContext();
  const { canManageSalesUsers, canManageAccountUsers } = productContext;
  if (!canManageSalesUsers) return <main className="employees-shell"><section className="employees-content"><WorkspacePageHeader title="Company Users" backHref="/workspace"/>{canManageAccountUsers&&<ProductUserManager edition={productContext.edition} users={productContext.users} branches={productContext.branches}/>}</section></main>;
  const { employees, trial, teamStructure } = await getEmployeeManagementContext();
  const actor=await requirePermission("SALES_USER_ADMIN");
  const readiness=actor.companyId?await db.company.findUnique({where:{id:actor.companyId},select:{name:true,teamStructure:true,addressLine1:true,city:true,state:true,postalCode:true,country:true,primaryContactName:true,primaryPhone:true,contactEmail:true,users:{where:{id:actor.id},select:{emailVerifiedAt:true},take:1}}}):null;
  const readinessError=!readiness?.users[0]?.emailVerifiedAt?"Verify your email to unlock employee creation.":!readiness||!profileComplete(readiness)?"Complete your company details to unlock employee creation.":null;
  const isPrimary=actor.salesRole==='PRIMARY_ADMIN';
  const branches=await listBranchAssignmentOptions();
  const [additionalAdmins,transferCandidates]=isPrimary?await Promise.all([listAdditionalAdmins(),listPrimaryAdminTransferCandidates()]):[[],[]];
  const managersEnabled = teamStructure === "MANAGERS_AND_SALES";
  const requested = (await searchParams).filter?.toUpperCase();
  const availableFilters = managersEnabled ? filters : filters.filter((value) => value !== "MANAGERS");
  const filter = availableFilters.find((value) => value === requested) ?? "ALL";
  const visible = employees.filter((employee) => {
    if (filter === "MANAGERS") return isManagerEmployee(employee);
    if (filter === "SALES") return isSalesEmployee(employee);
    if (filter === "ACTIVE") return employee.isActive && employee.salesAccessActive;
    if (filter === "INACTIVE") return !employee.isActive;
    return true;
  });
  const managers = employees.filter((employee) => isManagerEmployee(employee));
  const activeManagers = managers.filter((employee) => employee.isActive && employee.salesAccessActive);
  const activeSales = employees.filter((employee) => isSalesEmployee(employee) && employee.isActive && employee.salesAccessActive);
  const clientEmployee=(employee:(typeof employees)[number])=>({...employee,salesRole:employee.salesRole as SalesRole,dateOfJoining:employee.dateOfJoining?.toISOString().slice(0,10)??null,travelRatePerKm:employee.travelRatePerKm?.toString()??null});

  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader title="Employees" backHref="/workspace"/>
        {canManageAccountUsers&&<ProductUserManager edition={productContext.edition} users={productContext.users} branches={productContext.branches}/>}
        <div className="employees-title"><div><p className="muted">{managersEnabled ? "Manage your Managers and Sales team." : "Manage Sales employees who report directly to the Company Admin."}</p></div></div>
        <div className="employee-stats">
          {managersEnabled && <div><strong>{activeManagers.length}{trial.isInTrial ? ` / ${trial.managerAllowance}` : ""}</strong><span>Active Managers</span></div>}
          <div><strong>{activeSales.length}{trial.isInTrial ? ` / ${trial.salesAllowance}` : ""}</strong><span>Active Sales</span></div>
          <div><strong>{employees.filter((employee) => !employee.isActive).length}</strong><span>Inactive</span></div>
        </div>
        {(trial.isTrialExpired || trial.effectiveStatus === "SUSPENDED") && <p className="lifecycle-alert">Employee creation and reactivation are unavailable while the company is {trial.effectiveStatus.toLowerCase()}.</p>}
        {readinessError&&<p className="lifecycle-alert">{readinessError} <Link href="/workspace?setup=1&from=employees">Review requirements</Link></p>}
        <nav className="employee-filters" aria-label="Employee filters">{availableFilters.map((item) => <Link className={filter === item ? "active" : ""} key={item} href={item === "ALL" ? "/workspace/employees" : `/workspace/employees?filter=${item.toLowerCase()}`}>{item.charAt(0) + item.slice(1).toLowerCase()}</Link>)}</nav>
        {isPrimary&&<section className="billing-card"><h2>Administrators</h2><p className="muted">Primary Admin: {actor.name} · Included / Free</p><form action={manageAdditionalAdmin} className="employee-form"><input type="hidden" name="operation" value="create"/><h3>Add Additional Admin</h3><div className="field-grid"><label>Name<input name="name" required/></label><label>Email<input name="email" type="email" required/></label><label>Phone (optional)<input name="phone"/></label><label>Password<input name="password" type="password" minLength={12} required/></label><label>Confirm password<input name="confirmPassword" type="password" minLength={12} required/></label></div><button className="primary-button">Add Additional Admin</button></form>{additionalAdmins.map(admin=><article className="employee-card" key={admin.id}><strong>{admin.name}</strong><p>{admin.email} · {!admin.isActive?'Inactive identity':!admin.salesAccessActive?'Sales access suspended':'Active'}</p><details><summary>Manage Additional Admin</summary><div className="manage-grid"><form action={manageAdditionalAdmin} className="employee-form"><input type="hidden" name="operation" value="edit"/><input type="hidden" name="userId" value={admin.id}/><h3>Edit details</h3><label>Name<input name="name" defaultValue={admin.name} required/></label><label>Email<input name="email" type="email" defaultValue={admin.email} required/></label><label>Phone (optional)<input name="phone" defaultValue={admin.phone??''}/></label><button>Save changes</button></form><form action={manageAdditionalAdmin} className="employee-form"><input type="hidden" name="operation" value="reset-password"/><input type="hidden" name="userId" value={admin.id}/><h3>Reset password</h3><label>New password<input name="password" type="password" minLength={12} required/></label><label>Confirm password<input name="confirmPassword" type="password" minLength={12} required/></label><button>Reset password</button></form></div><form action={manageAdditionalAdmin}><input type="hidden" name="userId" value={admin.id}/><input type="hidden" name="operation" value={!admin.isActive?'activate':!admin.salesAccessActive?'restore-sales':'deactivate'}/><button className={admin.isActive&&admin.salesAccessActive?'danger-button':'primary-button'}>{!admin.isActive?'Reactivate identity':!admin.salesAccessActive?'Restore Sales access':admin.accountRole?'Suspend Sales access':'Deactivate identity'}</button></form></details></article>)}{transferCandidates.length>0&&<form action={transferPrimaryAdminAction} className="employee-form"><h3>Transfer Primary Admin</h3><label>Eligible Additional Admin<select name="targetUserId">{transferCandidates.map(candidate=><option value={candidate.id} key={candidate.id}>{candidate.name} · {candidate.email}</option>)}</select></label><button className="danger-button">Transfer authority</button></form>}</section>}
        <EmployeeManager employees={visible.map(clientEmployee)} managers={managers.map(clientEmployee)} managersEnabled={managersEnabled} canAdd={!readinessError&&(trial.effectiveStatus === "TRIAL" || trial.effectiveStatus === "ACTIVE")} canManageTravel={canManageEmployeeTravel(actor.salesRole)} branches={branches} />
      </section>
    </main>
  );
}
