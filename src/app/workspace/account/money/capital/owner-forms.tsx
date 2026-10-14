"use client";
import {Money} from "@/components/account/account-ui";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveOwnerIdentityAction,
  postOwnerEntryAction,
} from "@/app/actions/owner-identity";
type Option = { id: string; name: string };
export type OwnerView = Option & {
  partyType: "OWNER" | "PARTNER";
  userId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  currentBalances?:{capital:string;drawings:string;loan:string};
};
type Props = {
  owners: OwnerView[];
  users: Option[];
  branches: Option[];
  accounts: Array<Option & { balance: string }>;
  scopeQuery?:string;
  canManage: boolean;
  canPost: boolean;
  fundingRepayments?:Array<{id:string;branchId:string;assetName:string;ownerFinancialAccountId:string;remainingAmount:string}>;
};
export function OwnerForms({
  owners,
  users,
  branches,
  accounts,
  canManage,
  canPost,
  fundingRepayments=[],
  scopeQuery="",
}: Props) {
  const router = useRouter(),
    [pending, startTransition] = useTransition(),
    [editing, setEditing] = useState<OwnerView | null | undefined>(undefined),
    [message, setMessage] = useState<string | null>(null),
    [messageKind, setMessageKind] = useState<"success" | "error">("success"),
    [selectedOwner, setSelectedOwner] = useState(
      owners.find((owner) => owner.isActive)?.id ?? "",
    ),
    [entryType, setEntryType] = useState("INVESTMENT"),
    [errors, setErrors] = useState<Record<string, string[] | undefined>>({}),
    [entryError, setEntryError] = useState<string | null>(null),
    [entrySuccess, setEntrySuccess] = useState<string | null>(null);
  const [entryBranch,setEntryBranch]=useState(branches[0]?.id??""),[fundingAmounts,setFundingAmounts]=useState<Record<string,string>>({});
  const creationKey = useRef<string | null>(null),
    entryKey = useRef<string | null>(null),
    entryForm = useRef<HTMLFormElement>(null),
    [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id ?? "");
  const activeOwner = owners.some(
    (owner) => owner.isActive && owner.id === selectedOwner,
  )
    ? selectedOwner
    : (owners.find((owner) => owner.isActive)?.id ?? "");
  const activeAccount = accounts.some(
    (account) => account.id === selectedAccount,
  )
    ? selectedAccount
    : (accounts[0]?.id ?? "");
  const repaymentChoices=fundingRepayments.filter(row=>row.ownerFinancialAccountId===activeOwner&&row.branchId===entryBranch);
  function edit(owner: OwnerView | null) {
    setEditing(owner);
    setMessage(null);
    setErrors({});
    creationKey.current = crypto.randomUUID();
  }
  function identity(form: FormData) {
    if (pending) return;
    const value = Object.fromEntries(form);
    startTransition(async () => {
      const raw = editing
        ? {
            name: value.name,
            partyType: value.partyType,
            phone: value.phone,
            email: value.email,
            address: value.address,
            isActive: form.get("isActive") === "on",
          }
        : {
            name: value.name,
            partyType: value.partyType,
            userId: value.userId || undefined,
            phone: value.phone,
            email: value.email,
            address: value.address,
            branchId: value.branchId,
            creationRequestKey:
              creationKey.current ??
              (creationKey.current = crypto.randomUUID()),
          };
      const result = await saveOwnerIdentityAction(editing?.id ?? null, raw);
      setMessage(result.message);
      setMessageKind(result.kind);
      if (result.kind === "success") {
        setEditing(undefined);
        creationKey.current = null;
        router.refresh();
      } else setErrors(result.fieldErrors ?? {});
    });
  }
  function entry(form: FormData) {
    if (pending) return;
    setEntryError(null);
    setEntrySuccess(null);
    startTransition(async () => {
      const result = await postOwnerEntryAction({
        ownerFinancialAccountId: form.get("ownerFinancialAccountId"),
        moneyAccountId: form.get("moneyAccountId"),
        branchId: form.get("branchId"),
        type: form.get("type"),
        fundingReturns:entryType==="CAPITAL_WITHDRAWAL"?repaymentChoices.filter(row=>fundingAmounts[row.id]?.trim()).map(row=>({fundingId:row.id,amount:fundingAmounts[row.id].trim()})):[],
        amount: form.get("amount"),
        transactionDate: form.get("transactionDate"),
        reference: form.get("reference"),
        idempotencyKey:
          entryKey.current ?? (entryKey.current = crypto.randomUUID()),
      });
      if (result.kind === "error") setEntryError([result.message,...(result.fieldErrors?.fundingReturns??[])].join(" "));
      else {
        setEntrySuccess(result.message);
        entryKey.current = null;
        setFundingAmounts({});
        entryForm.current?.reset();
        router.refresh();
      }
    });
  }
  function selectEntry(ownerId: string, type: string) {
    setSelectedOwner(ownerId);
    setEntryType(type);
    setFundingAmounts({});
    entryForm.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    requestAnimationFrame(() =>
      entryForm.current
        ?.querySelector<HTMLInputElement>('input[name="amount"]')
        ?.focus(),
    );
  }
  return (
    <>
      <header className="owner-list-header">
        <h2>Owners &amp; Partners</h2>
        {canManage && (
          <button onClick={() => edit(null)} disabled={pending}>
            Add owner / partner
          </button>
        )}
      </header>
      {message && (
        <p role={messageKind === "error" ? "alert" : "status"}>{message}</p>
      )}
      {editing !== undefined && (
        <form
          key={editing?.id ?? "new"}
          onSubmit={(event) => {
            event.preventDefault();
            identity(new FormData(event.currentTarget));
          }}
          className="stack owner-identity-form"
        >
          <h3>{editing ? "Edit owner / partner" : "Add owner / partner"}</h3>
          <label>
            Name
            <input
              disabled={pending}
              name="name"
              defaultValue={editing?.name ?? ""}
              required
              maxLength={160}
            />
          </label>
          {errors.name && <p role="alert">{errors.name.join(" ")}</p>}
          <label>
            Type
            <select
              aria-label="Type"
              disabled={pending}
              name="partyType"
              defaultValue={editing?.partyType ?? "OWNER"}
            >
              <option value="OWNER">Owner</option>
              <option value="PARTNER">Partner</option>
            </select>
          </label>
          <label>
            Phone
            <input
              disabled={pending}
              name="phone"
              defaultValue={editing?.phone ?? ""}
              maxLength={40}
            />
          </label>
          <label>
            Email
            <input
              disabled={pending}
              name="email"
              type="email"
              defaultValue={editing?.email ?? ""}
              maxLength={320}
            />
          </label>
          <label>
            Address
            <textarea
              disabled={pending}
              name="address"
              defaultValue={editing?.address ?? ""}
              maxLength={2000}
            />
          </label>
          {editing ? (
            <label>
              <input
                disabled={pending}
                type="checkbox"
                name="isActive"
                defaultChecked={editing.isActive}
              />
              Active
            </label>
          ) : (
            <>
              <label>
                App user (optional)
                <select disabled={pending} name="userId" defaultValue="">
                  <option value="">No app user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Branch
                <select disabled={pending} name="branchId" required>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <div>
            <button disabled={pending}>
              {pending ? "Saving…" : "Save owner / partner"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditing(undefined)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="owner-cards">
        {owners.length === 0 ? (
          <p>No owners or partners yet.</p>
        ) : (
          owners.map((owner) => (
            <article key={owner.id}>
              <h3>{owner.name}</h3>
              <Link href={`/workspace/account/money/capital/${owner.id}${scopeQuery?`?${scopeQuery}`:""}`}>
                View {owner.name} history
              </Link>
              <p>
                {owner.partyType === "PARTNER" ? "Partner" : "Owner"} ·{" "}
                {owner.isActive ? "Active" : "Inactive"}
              </p>
              {owner.currentBalances&&<p>Capital: <Money value={owner.currentBalances.capital}/> · Profit drawings: <Money value={owner.currentBalances.drawings}/> · Owner loan: <Money value={owner.currentBalances.loan}/></p>}
              {owner.phone && <p>{owner.phone}</p>}
              {owner.email && <p>{owner.email}</p>}
              {canManage && (
                <button onClick={() => edit(owner)} disabled={pending}>
                  Edit {owner.name}
                </button>
              )}
              {canPost && owner.isActive && (
                <div>
                  <button
                    disabled={pending}
                    onClick={() => selectEntry(owner.id, "INVESTMENT")}
                  >
                    Add capital
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => selectEntry(owner.id, "PROFIT_DISTRIBUTION")}
                  >
                    Draw from profit
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => selectEntry(owner.id, "CAPITAL_WITHDRAWAL")}
                  >
                    Draw from capital
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>
      {canPost && (
        <form
          ref={entryForm}
          onSubmit={(event) => {
            event.preventDefault();
            entry(new FormData(event.currentTarget));
          }}
          className="stack owner-entry-form"
        >
          <h2>Capital &amp; Withdrawals</h2>
          <label>
            Owner / partner
            <select
              disabled={pending}
              name="ownerFinancialAccountId" aria-label="Owner / partner"
              value={activeOwner}
              onChange={(event) => {setSelectedOwner(event.target.value);setFundingAmounts({});}}
              required
            >
              {owners
                .filter((owner) => owner.isActive)
                .map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Transaction
            <select
              disabled={pending}
              name="type" aria-label="Transaction"
              value={entryType}
              onChange={(event) => {setEntryType(event.target.value);setFundingAmounts({});}}
            >
              <option value="INVESTMENT">Capital addition</option>
              <option value="CAPITAL_WITHDRAWAL">Capital withdrawal</option>
              <option value="PROFIT_DISTRIBUTION">Profit distribution</option>
              {canManage && (
                <option value="OWNER_LOAN">Owner loan received</option>
              )}
            </select>
          </label>
          <label>
            Money account
            <select
              disabled={pending}
              name="moneyAccountId" aria-label="Cash / bank account"
              value={activeAccount}
              onChange={(event) => setSelectedAccount(event.target.value)}
              required
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <p>
            Account balance:{" "}
            {accounts.find((account) => account.id === activeAccount)
              ?.balance ?? "Unavailable"}
          </p>
          <label>
            Branch
            <select disabled={pending} name="branchId" aria-label="Branch" required value={entryBranch} onChange={event=>{setEntryBranch(event.target.value);setFundingAmounts({});}}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          {entryType==="CAPITAL_WITHDRAWAL"&&owners.find(owner=>owner.id===activeOwner)?.currentBalances&&<p>Remaining posted capital: <Money value={owners.find(owner=>owner.id===activeOwner)!.currentBalances!.capital}/></p>}
          {entryType==="CAPITAL_WITHDRAWAL"&&repaymentChoices.length>0&&<fieldset><legend>Asset funding being repaid</legend><p>Enter the part of this capital withdrawal repaying each recorded asset allocation. Any remainder uses unallocated owner capital.</p>{repaymentChoices.map(row=><label key={row.id}>{row.assetName} — {row.remainingAmount} remaining<input disabled={pending} aria-label={`Repayment toward ${row.assetName}`} inputMode="decimal" pattern="[0-9]{1,16}(\.[0-9]{1,2})?" value={fundingAmounts[row.id]??""} onChange={event=>setFundingAmounts(old=>({...old,[row.id]:event.target.value}))}/></label>)}</fieldset>}
          <label>
            Amount
            <input
              disabled={pending}
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </label>
          <label>
            Date
            <input
              disabled={pending}
              name="transactionDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </label>
          <label>
            Reference
            <input disabled={pending} name="reference" maxLength={160} />
          </label>
          {entryError && <p role="alert">{entryError}</p>}
          {entrySuccess && <p role="status">{entrySuccess}</p>}
          <button
            disabled={
              pending ||
              owners.every((owner) => !owner.isActive) ||
              accounts.length === 0
            }
          >
            {pending ? "Posting…" : "Post owner transaction"}
          </button>
        </form>
      )}
    </>
  );
}
