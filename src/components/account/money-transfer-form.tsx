"use client";
import Link from "next/link";
import {transferModeChoices,type MoneyTransferMode} from "@/lib/account/money-transfer-modes";
import { useState,useRef } from "react";
import { saveMoneyTransferAction } from "@/app/actions/money";
import { ActionFeedbackForm, AccountFieldError } from "./action-feedback-form";
import { SavePendingFields, SaveSubmitButton } from "./save-feedback";
type Account = {
  id: string;
  name: string;
  branchId: string | null;
  isActive: boolean;
  type: string;
};
export function MoneyTransferForm({
  branches,
  accounts,
  requestKey,
  today,
  selectedBranch,
}: {
  branches: Array<{ id: string; name: string }>;
  accounts: Account[];
  requestKey: string;
  today: string;
  selectedBranch?:string;
}) {
  const imageInput=useRef<HTMLInputElement>(null);
  const [branch, setBranch] = useState(selectedBranch??branches[0]?.id ?? ""),
    [source, setSource] = useState(""),
    [destination, setDestination] = useState(""),
    [key, setKey] = useState(requestKey),
    [amount, setAmount] = useState(""),
    [mode,setMode]=useState<MoneyTransferMode>("BANK_TO_CASH");
  const choices = accounts.filter(
    (account) =>
      account.isActive && (!account.branchId || account.branchId === branch),
  );
  const sources=transferModeChoices(choices,mode,"source"),destinations=transferModeChoices(choices,mode,"destination");
  const ready =
    !!branch &&
    !!source &&
    !!destination &&
    source !== destination &&
    sources.some((row) => row.id === source) &&
    destinations.some((row) => row.id === destination);
  return (
    <ActionFeedbackForm
      action={saveMoneyTransferAction}
      className="stack"
      onSuccess={() => {
        setKey(crypto.randomUUID());
        setAmount("");
        if(imageInput.current)imageInput.current.value="";
      }}
    >
      <input type="hidden" name="idempotencyKey" value={key} />
      <SavePendingFields>
        <fieldset><legend>Deposit / Withdraw</legend>{([["BANK_TO_CASH","Bank to Cash"],["CASH_TO_BANK","Cash to Bank"],["BANK_TO_BANK","Bank to Bank"],["ALL","Other internal transfer"]] as const).map(([value,label])=><label key={value}><input type="radio" name="transferMode" value={value} checked={mode===value} onChange={()=>{setMode(value);setSource("");setDestination("");setKey(crypto.randomUUID());}}/>{label}</label>)}</fieldset>
        <details><summary>Adjust Bank Balance</summary><p>Select the bank account to add or reduce its balance with an offset ledger and reason.</p>{choices.filter(row=>row.type==="BANK").map(row=><p key={row.id}><Link href={`/workspace/account/money/accounts/${row.id}?branchId=${encodeURIComponent(branch)}`}>{row.name}</Link></p>)}</details>
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
            {sources.map((row) => (
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
            {destinations.map((row) => (
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
        <label>Description<textarea name="description" aria-label="Description" maxLength={2000}/><AccountFieldError name="description"/></label>
        <label>Image (optional)<input ref={imageInput} type="file" name="image" accept="image/png,image/jpeg,image/webp"/><small>PNG, JPEG or WebP, up to 5 MB. One image per transfer.</small></label>
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
