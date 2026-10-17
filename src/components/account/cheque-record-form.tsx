"use client";
import { useRef, useState } from "react";
import { saveChequeAction, searchChequeParties } from "@/app/actions/money";
import { ActionFeedbackForm, AccountFieldError } from "./action-feedback-form";
import { SaveSubmitButton,SavePendingFields } from "./save-feedback";
export function ChequeRecordForm({
  branches,
  accounts,
}: {
  branches: { id: string; name: string }[];
  accounts: { id: string; name: string; branchId: string | null }[];
}) {
  const [branch, setBranch] = useState(branches[0]?.id ?? "");
  const [direction, setDirection] = useState<"RECEIVED" | "ISSUED">("RECEIVED");
  const [requestKey,setRequestKey] = useState(() => crypto.randomUUID());
  const [number,setNumber]=useState(""),[date,setDate]=useState(""),[amount,setAmount]=useState(""),[reference,setReference]=useState("");
  const [search, setSearch] = useState("");
  const [parties, setParties] = useState<{ id: string; name: string }[]>([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [searching,setSearching]=useState(false);
  const [searchError, setSearchError] = useState("");
  const searchGeneration = useRef(0);
  async function findParties(nextOffset = 0) {
    const generation = ++searchGeneration.current;
    setSearchError("");setSearching(true);
    try {
      const result = await searchChequeParties({
        branchId: branch,
        direction,
        q: search,
        offset: nextOffset,
      });
      if (generation !== searchGeneration.current) return;
      setParties(result.rows);
      setMore(result.hasMore);
      setOffset(nextOffset);
    } catch {
      if (generation !== searchGeneration.current) return;
      setSearchError(
        "Unable to load parties. Check your branch access and try again.",
      );
    } finally {if(generation===searchGeneration.current)setSearching(false)}
  }
  const compatible = accounts.filter(
    (account) => !account.branchId || account.branchId === branch,
  );
  return (
    <ActionFeedbackForm action={saveChequeAction} className="stack" onSuccess={()=>{setRequestKey(crypto.randomUUID());setNumber("");setDate("");setAmount("");setReference("");setSearch("");setParties([]);setOffset(0);setMore(false);setSearching(false);searchGeneration.current++}}>
      <SavePendingFields>
      <input type="hidden" name="requestKey" value={requestKey} />
      <label>
        Branch
        <select
          aria-label="Branch"
          name="branchId"
          required
          value={branch}
          onChange={(event) => {
            searchGeneration.current++;
            setBranch(event.target.value);
            setParties([]);setOffset(0);setMore(false);setSearching(false);setSearchError("");
          }}
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
        <select
          aria-label="Bank account"
          name="moneyAccountId"
          required
          key={branch}
          defaultValue=""
        >
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
        <input name="chequeNumber" value={number} onChange={event=>setNumber(event.target.value)} required maxLength={80} />
        <AccountFieldError name="chequeNumber" />
      </label>
      <label>
        Cheque date
        <input type="date" name="chequeDate" value={date} onChange={event=>setDate(event.target.value)} required />
        <AccountFieldError name="chequeDate" />
      </label>
      <label>
        Direction
        <select
          aria-label="Direction"
          name="status"
          value={direction}
          onChange={(event) => {
            searchGeneration.current++;
            setDirection(event.target.value as "RECEIVED" | "ISSUED");
            setParties([]);setOffset(0);setMore(false);setSearching(false);setSearchError("");
          }}
        >
          <option value="RECEIVED">Received from customer</option>
          <option value="ISSUED">Issued to vendor</option>
        </select>
      </label>
      <label>
        Search party
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxLength={160}
        />
      </label>
      <button type="button" disabled={searching} onClick={() => void findParties()}>
        Find parties
      </button>
      {searchError && <p role="alert">{searchError}</p>}
      <label>
        Party
        <select
          aria-label="Party"
          name="partyId"
          required
          key={`${branch}:${direction}:${requestKey}`}
          defaultValue=""
        >
          <option value="">Select party</option>
          {parties.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      {offset > 0 && (
        <button
          type="button"
          disabled={searching}
          onClick={() => void findParties(Math.max(0, offset - 25))}
        >
          Previous parties
        </button>
      )}
      {more && (
        <button type="button" onClick={() => void findParties(offset + 25)}>
          More parties
        </button>
      )}
      <label>
        Amount
        <input
          value={amount} onChange={event=>setAmount(event.target.value)}
          name="amount"
          inputMode="decimal"
          required
          pattern="[0-9]+([.][0-9]{1,2})?"
        />
        <AccountFieldError name="amount" />
      </label>
      <p>
        This cheque becomes an advance when closed. Invoice-linked cheques can
        be recorded from the invoice payment flow.
      </p>
      <label>
        Reference
        <input name="reference" value={reference} onChange={event=>setReference(event.target.value)} maxLength={160} />
      </label>
      <SaveSubmitButton disabled={searching}>Record cheque</SaveSubmitButton>
      </SavePendingFields>
    </ActionFeedbackForm>
  );
}
