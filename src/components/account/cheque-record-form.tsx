"use client";
import { useState } from "react";
import { saveChequeAction } from "@/app/actions/money";
import { ActionFeedbackForm, AccountFieldError } from "./action-feedback-form";
import { SaveSubmitButton } from "./save-feedback";
export function ChequeRecordForm({
  branches,
  accounts,
}: {
  branches: { id: string; name: string }[];
  accounts: { id: string; name: string; branchId: string | null }[];
}) {
  const [branch, setBranch] = useState(branches[0]?.id ?? "");
  const compatible = accounts.filter(
    (account) => !account.branchId || account.branchId === branch,
  );
  return (
    <ActionFeedbackForm action={saveChequeAction} className="stack">
      <label>
        Branch
        <select
          name="branchId"
          required
          value={branch}
          onChange={(event) => setBranch(event.target.value)}
        >
          {branches.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Bank account
        <select name="moneyAccountId" required key={branch} defaultValue="">
          <option value="">Select bank account</option>
          {compatible.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        <AccountFieldError name="moneyAccountId" />
      </label>
      <label>
        Cheque number
        <input name="chequeNumber" required maxLength={80} />
        <AccountFieldError name="chequeNumber" />
      </label>
      <label>
        Cheque date
        <input type="date" name="chequeDate" required />
        <AccountFieldError name="chequeDate" />
      </label>
      <label>
        Party name
        <input name="partyName" required maxLength={240} />
        <AccountFieldError name="partyName" />
      </label>
      <label>
        Direction
        <select name="status" defaultValue="RECEIVED">
          <option value="RECEIVED">Received</option>
          <option value="ISSUED">Issued</option>
        </select>
      </label>
      <label>
        Reference
        <input name="reference" maxLength={160} />
      </label>
      <SaveSubmitButton>Record cheque</SaveSubmitButton>
    </ActionFeedbackForm>
  );
}
