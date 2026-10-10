"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createProjectAction } from "@/app/actions/projects";
import { ActionFeedbackForm, AccountFieldError } from "@/components/account/action-feedback-form";
type Branch = {id: string; name: string};
type Manager = {id: string; name: string; branchAccessScope: string; branchAccesses: {branchId: string}[]};
function Save() {
  const {pending} = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "Creating…" : "Create project"}</button>;
}
export function ProjectForm({branches, managers, accountAdmin}: {branches: Branch[]; managers: Manager[]; accountAdmin: boolean}) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [managerId, setManagerId] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const validManagers = managers.filter(manager => manager.branchAccessScope === "ALL_BRANCHES" || manager.branchAccesses.some(access => access.branchId === branchId));
  return <ActionFeedbackForm action={createProjectAction} className="stack">
    <input type="hidden" name="idempotencyKey" value={requestKey} />
    <fieldset className="form-grid" onChange={() => setRequestKey(crypto.randomUUID())}><legend>Project details</legend>
      <label>Project name<input name="name" maxLength={240} required /><AccountFieldError name="name" /></label>
      <label>Branch<select name="branchId" value={branchId} onChange={event => {setBranchId(event.target.value); setManagerId("");}} required>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      {accountAdmin && <label>Project manager<select name="projectManagerId" value={managerId} onChange={event => setManagerId(event.target.value)}><option value="">Unassigned</option>{validManagers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</select></label>}
      <label>Project value<input name="projectValue" inputMode="decimal" pattern="[0-9]{1,16}([.][0-9]{1,2})?" defaultValue="0" required /><AccountFieldError name="projectValue" /></label>
      <label>Site name<input name="siteName" maxLength={240} /></label>
      <label>Site address<textarea name="siteAddress" maxLength={4000} /></label>
      <label>Site contact<input name="siteContactName" maxLength={160} /></label>
      <label>Mobile number<input name="siteContactPhone" inputMode="tel" maxLength={30} /></label>
      <label>Start date<input type="date" name="startDate" /></label>
    </fieldset>
    <p>Status: Active</p><Save />
  </ActionFeedbackForm>;
}
