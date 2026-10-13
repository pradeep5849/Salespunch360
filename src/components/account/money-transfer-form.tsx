"use client";
import { useState } from "react";
import { saveMoneyTransferAction } from "@/app/actions/money";
import { ActionFeedbackForm, AccountFieldError } from "./action-feedback-form";
import { SavePendingFields, SaveSubmitButton } from "./save-feedback";
type Account = {
  id: string;
  name: string;
  branchId: string | null;
  isActive: boolean;
};
export function MoneyTransferForm({
  branches,
  accounts,
  requestKey,
  today,
}: {
  branches: Array<{ id: string; name: string }>;
  accounts: Account[];
  requestKey: string;
  today: string;
}) {
  const [branch, setBranch] = useState(branches[0]?.id ?? ""),
    [source, setSource] = useState(""),
    [destination, setDestination] = useState(""),
    [key, setKey] = useState(requestKey),
    [amount, setAmount] = useState("");
  const choices = accounts.filter(
    (account) =>
      account.isActive && (!account.branchId || account.branchId === branch),
  );
  const ready =
    !!branch &&
    !!source &&
    !!destination &&
    source !== destination &&
    choices.some((row) => row.id === source) &&
    choices.some((row) => row.id === destination);
  return (
    <ActionFeedbackForm
      action={saveMoneyTransferAction}
      className="stack"
      onSuccess={() => {
        setKey(crypto.randomUUID());
        setAmount("");
      }}
    >
      <input type="hidden" name="idempotencyKey" value={key} />
      <SavePendingFields>
        <label>
          Branch
          <select
            name="branchId"
            aria-label="Branch"
            value={branch}
            onChange={(event) => {
              setBranch(event.target.value);
              setSource("");
              setDestination("");
            }}
            required
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
          From account
          <select
            name="sourceAccountId"
            aria-label="From account"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            required
          >
            <option value="">Select account</option>
            {choices.map((row) => (
              <option
                key={row.id}
                value={row.id}
                disabled={row.id === destination}
              >
                {row.name}
              </option>
            ))}
          </select>
          <AccountFieldError name="sourceAccountId" />
        </label>
        <label>
          To account
          <select
            name="destinationAccountId"
            aria-label="To account"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            required
          >
            <option value="">Select account</option>
            {choices.map((row) => (
              <option key={row.id} value={row.id} disabled={row.id === source}>
                {row.name}
              </option>
            ))}
          </select>
          <AccountFieldError name="destinationAccountId" />
        </label>
        <label>
          Amount
          <input
            name="amount"
            aria-label="Amount"
            inputMode="decimal"
            pattern="[0-9]{1,16}(\.[0-9]{1,2})?"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
          <AccountFieldError name="amount" />
        </label>
        <label>
          Transfer date
          <input
            name="transferDate"
            aria-label="Transfer date"
            type="date"
            defaultValue={today}
            required
          />
          <AccountFieldError name="transferDate" />
        </label>
        <label>
          Reference
          <input name="reference" aria-label="Reference" maxLength={160} />
          <AccountFieldError name="reference" />
        </label>
        {choices.length < 2 && (
          <p role="status">
            Add two active accounts in this branch to make a transfer.
          </p>
        )}
      </SavePendingFields>
      <SaveSubmitButton disabled={!ready || !/^\d{1,16}(?:\.\d{1,2})?$/.test(amount) || !/[1-9]/.test(amount)}>
        Post transfer / deposit
      </SaveSubmitButton>
    </ActionFeedbackForm>
  );
}
