"use client";
import Link from "next/link";
import { useState } from "react";
import { saveMoneyAdjustmentAction } from "@/app/actions/money";
import { ActionFeedbackForm, AccountFieldError } from "./action-feedback-form";
import { SavePendingFields, SaveSubmitButton } from "./save-feedback";
export function MoneyAdjustmentForm({
  accountId,
  branches,
  ledgers,
  requestKey,
  selectedBranch,
}: {
  accountId: string;
  branches: Array<{ id: string; name: string }>;
  ledgers: Array<{ id: string; name: string; accountClass: string }>;
  requestKey: string;
  selectedBranch?: string;
}) {
  const [key, setKey] = useState(requestKey);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  return (
    <section>
      <h2>Add / Reduce balance</h2>
      <p>
        For owner funding or withdrawals, use{" "}
        <Link href="/workspace/account/money/capital">Capital & Drawings</Link>.
        For movement between bank and cash, use{" "}
        <Link href="/workspace/account/money/transfers">Transfer</Link>.
      </p>
      <ActionFeedbackForm
        action={saveMoneyAdjustmentAction}
        className="stack"
        onSuccess={() => {
          setKey(crypto.randomUUID());
          setAmount("");
          setReason("");
        }}
      >
        <input type="hidden" name="moneyAccountId" value={accountId} />
        <input type="hidden" name="idempotencyKey" value={key} />
        <SavePendingFields>
          <label>
            Posting branch
            <select
              name="branchId"
              aria-label="Posting branch"
              required
              defaultValue={selectedBranch ?? branches[0]?.id}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <AccountFieldError name="branchId" />
          </label>
          <label>
            Adjustment
            <select name="direction" aria-label="Adjustment">
              <option value="ADD">Add balance</option>
              <option value="REDUCE">Reduce balance</option>
            </select>
          </label>
          <label>
            Offset ledger
            <select
              name="offsetLedgerId"
              aria-label="Offset ledger"
              required
              defaultValue=""
            >
              <option value="">Select the reason’s ledger</option>
              {ledgers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.accountClass})
                </option>
              ))}
            </select>
            <AccountFieldError name="offsetLedgerId" />
          </label>
          <label>
            Amount
            <input
              name="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              required
              pattern="[0-9]{1,16}(\.[0-9]{1,2})?"
            />
            <AccountFieldError name="amount" />
          </label>
          <label>
            Date
            <input name="date" type="date" required />
            <AccountFieldError name="date" />
          </label>
          <label>
            Reason
            <textarea
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              maxLength={1000}
              required
            />
            <AccountFieldError name="reason" />
          </label>
        </SavePendingFields>
        <SaveSubmitButton disabled={!branches.length || !ledgers.length}>
          Post adjustment
        </SaveSubmitButton>
      </ActionFeedbackForm>
    </section>
  );
}
