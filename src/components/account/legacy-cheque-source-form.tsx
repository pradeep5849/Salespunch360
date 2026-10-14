"use client";
import { useState } from "react";
import {
  saveLegacyChequeSourceAction,
  searchChequeParties,
} from "@/app/actions/money";
import { ActionFeedbackForm } from "./action-feedback-form";
import { SaveSubmitButton } from "./save-feedback";

export function LegacyChequeSourceForm({
  id,
  version,
  branchId,
  direction,
}: {
  id: string;
  version: number;
  branchId: string;
  direction: "RECEIVED" | "ISSUED";
}) {
  const [key] = useState(() => crypto.randomUUID());
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<{ id: string; name: string }[]>([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function search(next = 0) {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await searchChequeParties({
        branchId,
        direction,
        q,
        offset: next,
      });
      setRows(result.rows);
      setMore(result.hasMore);
      setOffset(next);
    } catch {
      setError("Unable to load parties. Check your branch access and retry.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <ActionFeedbackForm action={saveLegacyChequeSourceAction} className="stack">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="requestKey" value={key} />
      <p>
        Confirm the original party and amount. These details create a pending
        advance; cash, bank and the party balance change only when you close the
        cheque.
      </p>
      <label>
        Search original party
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          maxLength={160}
          disabled={loading}
        />
      </label>
      <button type="button" disabled={loading} onClick={() => void search()}>
        Find original party
      </button>
      {error && <p role="alert">{error}</p>}
      <label>
        Original party
        <select
          aria-label="Original party"
          name="partyId"
          required
          defaultValue=""
        >
          <option value="">Select party</option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      {offset > 0 && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void search(Math.max(0, offset - 25))}
        >
          Previous parties
        </button>
      )}
      {more && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void search(offset + 25)}
        >
          More parties
        </button>
      )}
      <label>
        Original cheque amount
        <input
          name="amount"
          required
          inputMode="decimal"
          pattern="[0-9]+([.][0-9]{1,2})?"
        />
      </label>
      <SaveSubmitButton>Confirm source details</SaveSubmitButton>
    </ActionFeedbackForm>
  );
}
