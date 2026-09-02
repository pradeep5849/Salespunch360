"use client";

import { useActionState, useState } from "react";
import { manageEmployee, type EmployeeActionState } from "@/app/actions/employees";
import type { ManagerType, Role } from "@prisma/client";

type Employee = {
  id: string; name: string; email: string; phone: string | null; employeeCode: string | null;
  role: Role; managerType: ManagerType | null; isActive: boolean; managerId: string | null;
  manager: { id: string; name: string; isActive: boolean } | null;
};

const initialState: EmployeeActionState = {};

function ManagerSelect({ managers, defaultValue = "" }: { managers: Employee[]; defaultValue?: string }) {
  return <select name="managerId" defaultValue={defaultValue}><option value="">No manager</option>{managers.filter((manager) => manager.isActive || manager.id === defaultValue).map((manager) => <option key={manager.id} value={manager.id}>{manager.name}{manager.isActive ? "" : " (inactive — current)"}</option>)}</select>;
}

export function EmployeeManager({ employees, managers, managersEnabled, canAdd }: { employees: Employee[]; managers: Employee[]; managersEnabled: boolean; canAdd: boolean }) {
  const [state, action, pending] = useActionState(manageEmployee, initialState);
  const [createRole, setCreateRole] = useState<"MANAGER" | "SALES" | null>(null);
  return (
    <div>
      <div className="employee-actions">{managersEnabled && <button disabled={!canAdd} onClick={() => setCreateRole("MANAGER")}>Add Manager</button>}<button disabled={!canAdd} onClick={() => setCreateRole("SALES")}>Add Sales employee</button></div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}{state.success && <p className="form-success" role="status">{state.success}</p>}
      {createRole && <form action={action} className="employee-form create-form"><input type="hidden" name="operation" value={createRole === "MANAGER" ? "create-manager" : "create-sales"} /><div className="form-title"><h2>Add {createRole === "MANAGER" ? "Manager" : "Sales employee"}</h2><button type="button" className="close-button" onClick={() => setCreateRole(null)}>Close</button></div><div className="field-grid"><label className="field">Full name<input name="name" required /></label><label className="field">Email<input name="email" type="email" required /></label><label className="field">Phone (optional)<input name="phone" type="tel" /></label><label className="field">Employee code (optional)<input name="employeeCode" /></label>{createRole === "MANAGER" && <label className="field">Manager Type<select name="managerType" defaultValue="FIELD_MANAGER" required><option value="FIELD_MANAGER">Field Manager</option><option value="MANAGER_ONLY">Manager Only</option></select></label>}{createRole === "SALES" && managersEnabled && <label className="field full">Assigned Manager (optional)<ManagerSelect managers={managers} /></label>}<label className="field">Password<input name="password" type="password" minLength={12} required autoComplete="new-password" /></label><label className="field">Confirm password<input name="confirmPassword" type="password" minLength={12} required autoComplete="new-password" /></label></div><button className="primary-button" disabled={pending}>Create {createRole === "MANAGER" ? "Manager" : "Sales employee"}</button></form>}
      <div className="employee-list">
        {employees.length === 0 && <div className="empty-state"><h2>No employees found</h2><p>Try another filter or add your first team member.</p></div>}
        {employees.map((employee) => <article className={`employee-card ${employee.isActive ? "" : "inactive"}`} key={employee.id}>
          <div className="employee-summary"><div className="avatar">{employee.name.charAt(0).toUpperCase()}</div><div className="employee-identity"><div><h2>{employee.name}</h2><span className={`role-chip ${employee.role.toLowerCase()}`}>{employee.role === "MANAGER" ? (employee.managerType === "MANAGER_ONLY" ? "MANAGER ONLY" : "FIELD MANAGER") : employee.role}</span><span className={`state-chip ${employee.isActive ? "active" : ""}`}>{employee.isActive ? "Active" : "Inactive"}</span></div><p>{employee.email}{employee.employeeCode ? ` · ${employee.employeeCode}` : ""}</p><p>{employee.phone || "No phone"}{managersEnabled && (employee.manager ? ` · Manager: ${employee.manager.name}${employee.manager.isActive ? "" : " (inactive)"}` : employee.role === "SALES" ? " · Unassigned" : "")}</p></div></div>
          <details><summary>Manage</summary><div className="manage-grid"><form action={action} className="employee-form"><input type="hidden" name="operation" value="edit" /><input type="hidden" name="employeeId" value={employee.id} /><h3>Edit details</h3><label>Name<input name="name" defaultValue={employee.name} required /></label><label>Email<input name="email" type="email" defaultValue={employee.email} required /></label><label>Phone<input name="phone" defaultValue={employee.phone ?? ""} /></label><label>Employee code<input name="employeeCode" defaultValue={employee.employeeCode ?? ""} /></label>{employee.role === "MANAGER" && <label>Manager Type<select name="managerType" defaultValue={employee.managerType ?? "FIELD_MANAGER"} required><option value="FIELD_MANAGER">Field Manager</option><option value="MANAGER_ONLY">Manager Only</option></select></label>}{employee.role === "SALES" && managersEnabled && <label>Manager<ManagerSelect managers={managers} defaultValue={employee.managerId ?? ""} /></label>}<button disabled={pending}>Save changes</button></form><form action={action} className="employee-form"><input type="hidden" name="operation" value="reset-password" /><input type="hidden" name="employeeId" value={employee.id} /><h3>Set new password</h3><label>New password<input name="password" type="password" minLength={12} required autoComplete="new-password" /></label><label>Confirm password<input name="confirmPassword" type="password" minLength={12} required autoComplete="new-password" /></label><button disabled={pending}>Reset password</button></form></div><form action={action} onSubmit={(event) => { if (employee.isActive && !window.confirm(`Deactivate ${employee.name}? Their sessions will be revoked.`)) event.preventDefault(); }}><input type="hidden" name="operation" value={employee.isActive ? "deactivate" : "reactivate"} /><input type="hidden" name="employeeId" value={employee.id} /><button className={employee.isActive ? "danger-button" : "primary-button"} disabled={pending}>{employee.isActive ? "Deactivate employee" : "Reactivate employee"}</button></form></details>
        </article>)}
      </div>
    </div>
  );
}
