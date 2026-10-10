"use client";
import { useState, type ComponentProps } from "react";
import { accountingAction } from "@/app/actions/accounting";
import { ActionFeedbackForm } from "./action-feedback-form";
import { SaveSubmitButton } from "./save-feedback";
function JournalInput({
  defaultValue = "",
  ...props
}: ComponentProps<"input">) {
  const [value, setValue] = useState(String(defaultValue));
  return (
    <input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
function JournalSelect({
  defaultValue = "",
  ...props
}: ComponentProps<"select">) {
  const [value, setValue] = useState(String(defaultValue));
  return (
    <select
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
function JournalNarration() {
  const [value, setValue] = useState("");
  return (
    <textarea
      name="narration"
      maxLength={5000}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
type Option = { id: string; name: string; code?: string };
export function ManualJournalForm({
  opening,
  years,
  branches,
  accounts,
  costCentres,
}: {
  opening: boolean;
  years: Option[];
  branches: Option[];
  accounts: Option[];
  costCentres: Option[];
}) {
  const [lines, setLines] = useState([0, 1]);
  const [next, setNext] = useState(2);
  const [requestKey] = useState(() => crypto.randomUUID());
  return (
    <ActionFeedbackForm
      action={accountingAction}
      className="account-master-form"
    >
      <input
        type="hidden"
        name="operation"
        value={opening ? "opening" : "journal"}
      />
      <input type="hidden" name="sourceId" value={requestKey} />
      <label>
        Financial year
        <JournalSelect
          name="financialYearId"
          defaultValue={years[0]?.id ?? ""}
          required
        >
          {years.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </JournalSelect>
      </label>
      <label>
        Branch
        <JournalSelect
          name="branchId"
          defaultValue={branches[0]?.id ?? ""}
          required
        >
          {branches.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </JournalSelect>
      </label>
      <label>
        Date
        <JournalInput type="date" name="entryDate" required />
      </label>
      <label>
        Reference
        <JournalInput name="reference" maxLength={160} />
      </label>
      {lines.map((key, i) => (
        <fieldset key={key}>
          <legend>Line {i + 1}</legend>
          <label>
            Ledger account
            <JournalSelect name="ledgerAccountId" required>
              <option value="">Select ledger</option>
              {accounts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} · {x.name}
                </option>
              ))}
            </JournalSelect>
          </label>
          <label>
            Cost centre
            <JournalSelect name="costCentreId">
              <option value="">None</option>
              {costCentres.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </JournalSelect>
          </label>
          <label>
            Debit
            <JournalInput
              name="debit"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              required
            />
          </label>
          <label>
            Credit
            <JournalInput
              name="credit"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              required
            />
          </label>
          <label>
            Description
            <JournalInput name="description" maxLength={1000} />
          </label>
          <button
            type="button"
            disabled={lines.length <= 2}
            onClick={() => setLines(lines.filter((x) => x !== key))}
          >
            Remove line {i + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={lines.length >= 500}
        onClick={() => {
          setLines([...lines, next]);
          setNext(next + 1);
        }}
      >
        Add line
      </button>
      <label>
        Narration
        <JournalNarration />
      </label>
      <p>
        Each line must have either a debit or a credit. Total debits must equal
        total credits. Retry after a connection error to confirm the same
        posting.
      </p>
      <SaveSubmitButton>Post balanced entry</SaveSubmitButton>
    </ActionFeedbackForm>
  );
}
