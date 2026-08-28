import type { Metadata } from "next";
import Link from "next/link";
import { getEmployeeManagementContext } from "@/lib/employees/service";
import { EmployeeManager } from "./employee-manager";

export const metadata: Metadata = { title: "Employees" };

const filters = ["ALL", "MANAGERS", "SALES", "ACTIVE", "INACTIVE"] as const;

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { employees, trial } = await getEmployeeManagementContext();
  const requested = (await searchParams).filter?.toUpperCase();
  const filter = filters.find((value) => value === requested) ?? "ALL";
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
      <header className="employees-header"><Link href="/workspace">← Workspace</Link><div className="logo"><span>SP</span> SalesPunch360</div></header>
      <section className="employees-content">
        <div className="employees-title"><div><p className="eyebrow">Company administration</p><h1>Employees</h1><p className="muted">Manage your Managers and Sales team.</p></div></div>
        <div className="employee-stats">
          <div><strong>{activeManagers.length}{trial.isInTrial ? ` / ${trial.managerAllowance}` : ""}</strong><span>Active Managers</span></div>
          <div><strong>{activeSales.length}{trial.isInTrial ? ` / ${trial.salesAllowance}` : ""}</strong><span>Active Sales</span></div>
          <div><strong>{employees.filter((employee) => !employee.isActive).length}</strong><span>Inactive</span></div>
        </div>
        {(trial.isTrialExpired || trial.effectiveStatus === "SUSPENDED") && <p className="lifecycle-alert">Employee creation and reactivation are unavailable while the company is {trial.effectiveStatus.toLowerCase()}.</p>}
        <nav className="employee-filters" aria-label="Employee filters">{filters.map((item) => <Link className={filter === item ? "active" : ""} key={item} href={item === "ALL" ? "/workspace/employees" : `/workspace/employees?filter=${item.toLowerCase()}`}>{item.charAt(0) + item.slice(1).toLowerCase()}</Link>)}</nav>
        <EmployeeManager employees={visible} managers={managers} canAdd={trial.effectiveStatus === "TRIAL" || trial.effectiveStatus === "ACTIVE"} />
      </section>
    </main>
  );
}
