"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { categoryAction } from "@/app/actions/expenses";
import { SaveSubmitButton } from "./save-feedback";
import { ActionFeedbackForm } from "./action-feedback-form";
type Ledger = { id: string; code: string; name: string; accountClass: string };
type Category = {
  id: string;
  name: string;
  scope: string;
  defaultLedgerAccountId: string;
  incomeLedgerAccountId: string | null;
};
export function ExpenseCategoryForm({
  ledgers,
  category,
  onSaved,
}: {
  ledgers: Ledger[];
  category?: Category;
  onSaved?: (name: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? ""),
    [scope, setScope] = useState(category?.scope ?? "EXPENSE"),
    [ledger, setLedger] = useState(category?.defaultLedgerAccountId ?? ""),
    [income, setIncome] = useState(category?.incomeLedgerAccountId ?? "");
  const ledgerClass = scope === "INCOME" ? "INCOME" : "EXPENSE";
  const select = (
    label: string,
    value: string,
    set: (v: string) => void,
    accountClass: string,
    field: string,
  ) => (
    <label>
      {label}
      <select
        name={field}
        aria-label={label}
        required
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">Select {accountClass.toLowerCase()} ledger</option>
        {ledgers
          .filter((x) => x.accountClass === accountClass)
          .map((x) => (
            <option key={x.id} value={x.id}>
              {x.code} · {x.name}
            </option>
          ))}
      </select>
    </label>
  );
  return (
    <ActionFeedbackForm
      action={categoryAction}
      className="stack"
      onSuccess={() => {
        router.refresh();
        onSaved?.(name.trim());
      }}
    >
      {category && <input type="hidden" name="id" value={category.id} />}
      <label>
        Category name
        <input
          name="name"
          required
          maxLength={160}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Scope
        <select
          name="scope"
          aria-label="Scope"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            setLedger("");
            setIncome("");
          }}
        >
          {["EXPENSE", "INCOME", "BOTH"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      {select(
        scope === "BOTH" ? "Expense posting ledger" : "Posting ledger",
        ledger,
        setLedger,
        ledgerClass,
        "defaultLedgerAccountId",
      )}
      {scope === "BOTH" &&
        select(
          "Income posting ledger",
          income,
          setIncome,
          "INCOME",
          "incomeLedgerAccountId",
        )}
      <SaveSubmitButton>
        {category ? "Save category" : "Create category"}
      </SaveSubmitButton>
    </ActionFeedbackForm>
  );
}
