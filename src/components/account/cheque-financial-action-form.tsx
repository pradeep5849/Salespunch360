"use client";
import { useState } from "react";
import { saveChequeFinancialAction } from "@/app/actions/money";
import { ActionFeedbackForm } from "./action-feedback-form";
import { SaveSubmitButton } from "./save-feedback";

export function ChequeFinancialActionForm({
  id,
  version,
  actions,
  accounts,
}: {
  id: string;
  version: number;
  actions: string[];
  accounts: { id: string; name: string }[];
}) {
  const [action, setAction] = useState(actions[0]);
  const [requestKey] = useState(() => crypto.randomUUID());
  return (
    <ActionFeedbackForm action={saveChequeFinancialAction} className="stack">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="requestKey" value={requestKey} />
      <label>
        Cheque action
        <select
          aria-label="Cheque action"
          name="action"
          value={action}
          onChange={(event) => setAction(event.target.value)}
        >
          {actions.map((value) => (
            <option key={value} value={value}>
              {value === "CLOSE"
                ? "Close cheque"
                : value === "REOPEN"
                  ? "Re-open cheque"
                  : value === "BOUNCE"
                    ? "Record bounced cheque"
                    : "Cancel cheque"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Action date
        <input name="actionDate" type="date" required />
      </label>
      {action === "CLOSE" ? (
        <>
          <label>
            Payment account
            <select
              aria-label="Payment account"
              name="moneyAccountId"
              required
              defaultValue=""
            >
              <option value="">Select account</option>
              {accounts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <p>Closing posts the payment and settles the allocated invoice.</p>
        </>
      ) : (
        <>
          <label>
            Reason
            <textarea name="reason" required maxLength={500} />
          </label>
          <p>
            Any closure payment is reversed and the invoice balance is restored.
          </p>
        </>
      )}
      <SaveSubmitButton>Confirm cheque action</SaveSubmitButton>
    </ActionFeedbackForm>
  );
}
