import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { getEmployeeManagementContext } from "@/lib/employees/service";
import { EmployeeManager } from "./employee-manager";
import { requireRole } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { profileComplete } from "@/lib/company/profile";

export const metadata: Metadata = { title: "Employees" };

const filters = ["ALL", "MANAGERS", "SALES", "ACTIVE", "INACTIVE"] as const;

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { employees, trial, teamStructure } = await getEmployeeManagementContext();
  const actor=await requireRole("COMPANY_ADMIN");
  const readiness=actor.companyId?await db.company.findUnique({where:{id:actor.companyId},select:{name:true,teamStructure:true,addressLine1:true,city:true,state:true,postalCode:true,country:true,primaryContactName:true,primaryPhone:true,contactEmail:true,users:{where:{id:actor.id},select:{emailVerifiedAt:true},take:1}}}):null;
  const readinessError=!readiness?.users[0]?.emailVerifiedAt?"Verify your email to unlock employee creation.":!readiness||!profileComplete(readiness)?"Complete your company details to unlock employee creation.":null;
  const managersEnabled = teamStructure === "MANAGERS_AND_SALES";
  const requested = (await searchParams).filter?.toUpperCase();
  const availableFilters = managersEnabled ? filters : filters.filter((value) => value !== "MANAGERS");
  const filter = availableFilters.find((value) => value === requested) ?? "ALL";
  const visible = employees.filter((employee) => {
    if (filter === "MANAGERS") return employee.role === "MANAGER";
    if (filter === "SALES") return employee.role === "SALES";
    if (filter === "ACTIVE") return employee.isActive;
    if (filter === "INACTIVE") return !employee.isActive;
    return true;
  });
  const managers = employees.filter((employee) => employee.role === "MANAGER");
  const activeManagers = managers.filter((employee) => employee.isActive);
  const activeSales = employees.filter((employee) => employee.role === "SALES" && employee.isActive);

  return (
    <main className="employees-shell">
      <header className="employees-header"><Link href="/workspace">← Workspace</Link><BrandLogo href="/workspace" /></header>
      <section className="employees-content">
        <div className="employees-title"><div><p className="eyebrow">Company administration</p><h1>Employees</h1><p className="muted">{managersEnabled ? "Manage your Managers and Sales team." : "Manage Sales employees who report directly to the Company Admin."}</p></div></div>
        <div className="employee-stats">
          {managersEnabled && <div><strong>{activeManagers.length}{trial.isInTrial ? ` / ${trial.managerAllowance}` : ""}</strong><span>Active Managers</span></div>}
          <div><strong>{activeSales.length}{trial.isInTrial ? ` / ${trial.salesAllowance}` : ""}</strong><span>Active Sales</span></div>
          <div><strong>{employees.filter((employee) => !employee.isActive).length}</strong><span>Inactive</span></div>
        </div>
        {(trial.isTrialExpired || trial.effectiveStatus === "SUSPENDED") && <p className="lifecycle-alert">Employee creation and reactivation are unavailable while the company is {trial.effectiveStatus.toLowerCase()}.</p>}
        {readinessError&&<p className="lifecycle-alert">{readinessError} <Link href="/workspace?setup=1&from=employees">Review requirements</Link></p>}
        <nav className="employee-filters" aria-label="Employee filters">{availableFilters.map((item) => <Link className={filter === item ? "active" : ""} key={item} href={item === "ALL" ? "/workspace/employees" : `/workspace/employees?filter=${item.toLowerCase()}`}>{item.charAt(0) + item.slice(1).toLowerCase()}</Link>)}</nav>
        <EmployeeManager employees={visible} managers={managers} managersEnabled={managersEnabled} canAdd={!readinessError&&(trial.effectiveStatus === "TRIAL" || trial.effectiveStatus === "ACTIVE")} />
      </section>
    </main>
  );
}
