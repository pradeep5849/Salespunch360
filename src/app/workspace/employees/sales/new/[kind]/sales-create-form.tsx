"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { manageEmployee } from "@/app/actions/employees";

type Branch = { id: string; name: string; code: string };
type Manager = { id: string; name: string };

export function SalesCreateForm({ branches, managers, managersEnabled }: { branches: Branch[]; managers: Manager[]; managersEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(manageEmployee, {});
  const router = useRouter();
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  useEffect(() => {
    if (!state.success) return;
    router.replace("/workspace/employees?filter=sales");
    router.refresh();
  }, [router, state.success]);

  return <form action={formAction} className="employee-form">
    <input type="hidden" name="operation" value="create-sales"/>
    <input type="hidden" name="configureTravel" value="yes"/>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    {state.success ? <p className="form-success" role="status">{state.success}</p> : null}
    <label>Name<input name="name" required/>{fieldError("name")&&<span className="form-error">{fieldError("name")}</span>}</label>
    <label>Email<input name="email" type="email" required/>{fieldError("email")&&<span className="form-error">{fieldError("email")}</span>}</label>
    <label>Phone<input name="phone"/>{fieldError("phone")&&<span className="form-error">{fieldError("phone")}</span>}</label>
    <label>Employee code<input name="employeeCode"/>{fieldError("employeeCode")&&<span className="form-error">{fieldError("employeeCode")}</span>}</label>
    <label>Designation<input name="designation"/>{fieldError("designation")&&<span className="form-error">{fieldError("designation")}</span>}</label>
    <label>Date of Joining<input name="dateOfJoining" type="date"/>{fieldError("dateOfJoining")&&<span className="form-error">{fieldError("dateOfJoining")}</span>}</label>
    <label>Branch scope<select name="branchAccessScope" defaultValue="ALL_BRANCHES"><option value="ALL_BRANCHES">All Branches</option><option value="SELECTED_BRANCHES">Selected Branches</option></select>{fieldError("branchAccessScope")&&<span className="form-error">{fieldError("branchAccessScope")}</span>}</label>
    <fieldset><legend>Selected Branches</legend>{branches.length?branches.map(branch=><label key={branch.id}><input type="checkbox" name="branchIds" value={branch.id}/>{branch.name} ({branch.code})</label>):<p className="muted">No branches configured.</p>}{fieldError("branchIds")&&<span className="form-error">{fieldError("branchIds")}</span>}</fieldset>
    {managersEnabled&&<label>Assigned Manager<select name="managerId" defaultValue=""><option value="">No manager</option>{managers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError("managerId")&&<span className="form-error">{fieldError("managerId")}</span>}</label>}
    <fieldset><legend>Travel Expense</legend>
      <label><input name="travelAllowanceEnabled" type="checkbox"/>Enable daily travel expense for this user</label>
      <label>₹ per km for this user<input name="travelRatePerKm" type="number" min="0" step="0.01" placeholder="Use company default if blank"/></label>
      <label>Expense approval<select name="travelApprovalMode" defaultValue="MANUAL"><option value="MANUAL">Manual — Admin approves each day</option><option value="AUTO">Auto — approve calculated daily expense automatically</option></select></label>
      <p className="muted">Distance uses validated GPS movement while attendance is active. Each attendance session is calculated separately.</p>
    </fieldset>
    <label>Password<input name="password" type="password" minLength={12} required/>{fieldError("password")&&<span className="form-error">{fieldError("password")}</span>}</label>
    <label>Confirm password<input name="confirmPassword" type="password" minLength={12} required/>{fieldError("confirmPassword")&&<span className="form-error">{fieldError("confirmPassword")}</span>}</label>
    <div><button type="submit" disabled={pending}>{pending?"Saving...":"Save"}</button>{" "}<Link href="/workspace/employees">Cancel</Link></div>
  </form>;
}
