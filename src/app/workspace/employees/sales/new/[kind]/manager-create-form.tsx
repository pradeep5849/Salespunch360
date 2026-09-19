"use client";

import Link from "next/link";
import { useActionState } from "react";
import { manageEmployee } from "@/app/actions/employees";

type Branch = { id: string; name: string; code: string };

export function ManagerCreateForm({ branches }: { branches: Branch[] }) {
  const [state, formAction, pending] = useActionState(manageEmployee, {});
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  return (
    <form action={formAction} className="employee-form">
      <input type="hidden" name="returnTo" value="/workspace/employees" />
      <input type="hidden" name="operation" value="create-manager" />

      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}

      <label>
        Name
        <input name="name" required />
        {fieldError("name") ? <span className="form-error">{fieldError("name")}</span> : null}
      </label>
      <label>
        Email
        <input name="email" type="email" required />
        {fieldError("email") ? <span className="form-error">{fieldError("email")}</span> : null}
      </label>
      <label>
        Phone
        <input name="phone" />
        {fieldError("phone") ? <span className="form-error">{fieldError("phone")}</span> : null}
      </label>
      <label>
        Employee code
        <input name="employeeCode" />
        {fieldError("employeeCode") ? <span className="form-error">{fieldError("employeeCode")}</span> : null}
      </label>
      <label>
        Designation
        <input name="designation" />
        {fieldError("designation") ? <span className="form-error">{fieldError("designation")}</span> : null}
      </label>
      <label>
        Date of Joining
        <input name="dateOfJoining" type="date" />
        {fieldError("dateOfJoining") ? <span className="form-error">{fieldError("dateOfJoining")}</span> : null}
      </label>
      <label>
        Branch scope
        <select name="branchAccessScope" defaultValue="ALL_BRANCHES">
          <option value="ALL_BRANCHES">All Branches</option>
          <option value="SELECTED_BRANCHES">Selected Branches</option>
        </select>
        {fieldError("branchAccessScope") ? <span className="form-error">{fieldError("branchAccessScope")}</span> : null}
      </label>
      <fieldset>
        <legend>Selected Branches</legend>
        {branches.length ? branches.map((branch) => (
          <label key={branch.id}>
            <input type="checkbox" name="branchIds" value={branch.id} />
            {branch.name} ({branch.code})
          </label>
        )) : <p className="muted">No branches configured.</p>}
        {fieldError("branchIds") ? <span className="form-error">{fieldError("branchIds")}</span> : null}
      </fieldset>
      <label>
        Manager type
        <select name="managerType" defaultValue="FIELD_MANAGER">
          <option value="FIELD_MANAGER">Field Manager</option>
          <option value="MANAGER_ONLY">Office Manager</option>
        </select>
        {fieldError("managerType") ? <span className="form-error">{fieldError("managerType")}</span> : null}
      </label>
      <label>
        Password
        <input name="password" type="password" minLength={12} required />
        {fieldError("password") ? <span className="form-error">{fieldError("password")}</span> : null}
      </label>
      <label>
        Confirm password
        <input name="confirmPassword" type="password" minLength={12} required />
        {fieldError("confirmPassword") ? <span className="form-error">{fieldError("confirmPassword")}</span> : null}
      </label>

      <div>
        <button type="submit" disabled={pending}>{pending ? "Saving..." : "Save"}</button>{" "}
        <Link href="/workspace/employees">Cancel</Link>
      </div>
    </form>
  );
}
