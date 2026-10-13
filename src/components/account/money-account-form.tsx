"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveMoneyAccountAction } from "@/app/actions/money";
import {
  ActionFeedbackForm,
  AccountFieldError,
  useAccountFieldError,
} from "./action-feedback-form";
import { SavePendingFields, SaveSubmitButton } from "./save-feedback";
function Field({
  name,
  label,
  maxLength,
  required = false,
}: {
  name: string;
  label: string;
  maxLength: number;
  required?: boolean;
}) {
  const error = useAccountFieldError(name);
  return (
    <label>
      {label}
      <input
        name={name}
        aria-label={label}
        maxLength={maxLength}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      <AccountFieldError name={name} />
    </label>
  );
}
function FocusErrors() {
  const nameError = useAccountFieldError("name"),
    branchError = useAccountFieldError("branchId"),
    typeError = useAccountFieldError("type");
  const bankError = useAccountFieldError("bankName"),
    numberError = useAccountFieldError("accountNumberMasked"),
    ifscError = useAccountFieldError("ifsc");
  const openingError = useAccountFieldError("openingBalance"),
    dateError = useAccountFieldError("openingDate"),
    openingBranchError = useAccountFieldError("openingBranchId");
  const ref = useRef<HTMLSpanElement>(null);
  const { pending } = useFormStatus();
  useEffect(() => {
    if (
      !pending &&
      (nameError ||
        branchError ||
        typeError ||
        bankError ||
        numberError ||
        ifscError ||
        openingError ||
        dateError ||
        openingBranchError)
    )
      ref.current
        ?.closest("form")
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
  }, [
    pending,
    nameError,
    branchError,
    typeError,
    bankError,
    numberError,
    ifscError,
    openingError,
    dateError,
    openingBranchError,
  ]);
  return <span ref={ref} />;
}
function Choice({
  name,
  label,
  children,
  defaultValue,
}: {
  defaultValue?: string;
  name: string;
  label: string;
  children: React.ReactNode;
}) {
  const error = useAccountFieldError(name);
  return (
    <label>
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        aria-label={label}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      >
        {children}
      </select>
      <AccountFieldError name={name} />
    </label>
  );
}
export function MoneyAccountForm({
  branches,
  creationRequestKey,
  initialType = "BANK",
}: {
  branches: Array<{ id: string; name: string }>;
  creationRequestKey: string;
  initialType?: "BANK" | "CASH" | "PETTY_CASH";
}) {
  const [requestKey, setRequestKey] = useState(creationRequestKey);
  return (
    <ActionFeedbackForm
      action={saveMoneyAccountAction}
      className="stack"
      onSuccess={() => setRequestKey(crypto.randomUUID())}
    >
      <input type="hidden" name="creationRequestKey" value={requestKey} />
      <FocusErrors />
      <SavePendingFields>
        <Choice name="type" label="Account type" defaultValue={initialType}>
          <option value="BANK">Bank</option>
          <option value="CASH">Cash</option>
          <option value="PETTY_CASH">Petty Cash</option>
        </Choice>
        <Field
          name="name"
          label="Account display name"
          maxLength={160}
          required
        />
        <Choice name="branchId" label="Branch">
          <option value="">Company-wide</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </Choice>
        <Field name="bankName" label="Bank name" maxLength={160} />
        <Field
          name="accountNumberMasked"
          label="Masked account number"
          maxLength={40}
        />
        <Field name="ifsc" label="IFSC" maxLength={20} />
        <Field
          name="openingBalance"
          label="Starting balance (optional)"
          maxLength={20}
        />
        <label>
          As on date
          <input type="date" name="openingDate" aria-label="As on date" />
          <AccountFieldError name="openingDate" />
        </label>
        <Choice
          name="openingBranchId"
          label="Opening journal branch (for company-wide accounts)"
        >
          <option value="">Use account branch</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </Choice>
        <p>
          A non-zero starting balance posts against Opening Balance Equity.
          Select its date and branch.
        </p>
      </SavePendingFields>
      <SaveSubmitButton>Create account and asset ledger</SaveSubmitButton>
    </ActionFeedbackForm>
  );
}
