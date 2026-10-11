"use client";
import { useState } from "react";
import { ActionFeedbackForm, AccountFieldError } from "./action-feedback-form";
import { SavePendingFields, SaveSubmitButton } from "./save-feedback";
import type { AccountActionResult } from "@/lib/account/action-feedback";
type Option = { id: string; name: string };
export function RecurringExpenseForm({
  branches,
  categories,
  projects,
  requestKey,
  action,
}: {
  branches: Option[];
  categories: Option[];
  projects: (Option & { branchId: string })[];
  requestKey: string;
  action: (form: FormData) => Promise<AccountActionResult>;
}) {
  const [branch, setBranch] = useState(branches[0]?.id ?? ""),
    [project, setProject] = useState("");
  return (
    <ActionFeedbackForm action={action} className="account-form">
      <SavePendingFields>
        <input type="hidden" name="creationRequestKey" value={requestKey} />
        <label>
          Branch
          <select
            name="branchId"
            required
            value={branch}
            onChange={(event) => {
              setBranch(event.target.value);
              setProject("");
            }}
          >
            {branches.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <AccountFieldError name="branchId" />
        </label>
        <label>
          Expense category
          <select name="categoryId" required>
            {categories.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <AccountFieldError name="categoryId" />
        </label>
        <label>
          Project
          <select
            name="projectId"
            value={project}
            onChange={(event) => setProject(event.target.value)}
          >
            <option value="">Office expense</option>
            {projects
              .filter((row) => row.branchId === branch)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Frequency
          <select name="frequency" defaultValue="MONTHLY">
            {["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          First due date
          <input type="date" name="nextDueDate" required />
          <AccountFieldError name="nextDueDate" />
        </label>
        <label>
          Amount
          <input name="amount" type="number" min="0.01" step="0.01" required />
          <AccountFieldError name="amount" />
        </label>
      </SavePendingFields>
      <SaveSubmitButton>Create schedule</SaveSubmitButton>
    </ActionFeedbackForm>
  );
}
