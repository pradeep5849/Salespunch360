"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LegacyMoneyForm } from "./money-form";
import {
  receiptEntryReview,
  createReceiptMoneyAccount,
} from "@/app/actions/receipt-entry";
import { createSaleCustomerAction } from "@/app/actions/account-masters";
import { saveSettlementWithFeedback } from "@/app/actions/commercial";
import {
  receiptCents,
  receiptLinkReview,
  type ReceiptLink,
} from "@/lib/account/receipt-link-review";
import { useDisplayPreferences } from "@/components/account/display-preferences";
import {
  formatMoney,
  formatCalendarDate,
} from "@/lib/account/display-preferences";
import { reportCalendarDate } from "@/lib/account/reports/dates";
type Props = Parameters<typeof LegacyMoneyForm>[0];
function ReviewDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      style={{ width: "min(95vw,700px)", maxHeight: "90dvh", overflow: "auto" }}
    >
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h2>{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function ReceiptEntry(p: Props) {
  const decimal = (value: bigint) =>
    `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, "0")}`;
  const display = useDisplayPreferences(),
    router = useRouter(),
    draft = p.initialDraft;
  const [branchId, setBranch] = useState(
    draft?.branchId ?? p.initialBranchId ?? p.branches[0]?.id ?? "",
  );
  const [customers, setCustomers] = useState(p.customers),
    [accounts, setAccounts] = useState(p.moneyAccounts);
  const [partyId, setParty] = useState(draft?.partyId ?? ""),
    [search, setSearch] = useState(""),
    [billingName, setBillingName] = useState("");
  const [amount, setAmount] = useState(draft?.amount ?? ""),
    [date, setDate] = useState(reportCalendarDate()),
    [notes, setNotes] = useState(draft?.notes ?? "");
  const [accountId, setAccount] = useState(draft?.moneyAccountId ?? ""),
    [key, setKey] = useState(() => crypto.randomUUID());
  const [links, setLinks] = useState<ReceiptLink[]>([]),
    [editLinks, setEditLinks] = useState<ReceiptLink[]>([]),
    [editAmount, setEditAmount] = useState("");
  const [dialog, setDialog] = useState<
      "links" | "party" | "account" | "menu" | null
    >(null),
    [pending, setPending] = useState(false),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [reviewData, setReview] = useState<{
      context: string;
      balance: string | null;
      receiptNumber: string | null;
      advanceNumber: string | null;
    } | null>(null),
    [reviewError, setReviewError] = useState("");
  const accountKey = useRef(crypto.randomUUID());
  const attempted = useRef<FormData | null>(null);
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    let live = true;
    if (branchId)
      receiptEntryReview(branchId, partyId || undefined)
        .then((row) => {
          if (live) {
            setReview({ ...row, context: branchId + ":" + partyId });
            setReviewError("");
          }
        })
        .catch(() => {
          if (live)
            setReviewError(
              "Unable to load the current balance and receipt number. Retry or refresh before saving.",
            );
        });
    return () => {
      live = false;
    };
  }, [branchId, partyId, message]);
  const review =
    reviewData?.context === branchId + ":" + partyId ? reviewData : null;
  const docs = p.documents.filter(
    (row) =>
      row.partyId === partyId &&
      row.branchId === branchId &&
      row.type === "SALES_INVOICE",
  );
  const limits = new Map(
    docs.map((row) => [`document:${row.id}`, row.outstanding]),
  );
  const allocation = receiptLinkReview(amount, links, limits),
    editing = receiptLinkReview(editAmount, editLinks, limits);
  const selectedAccount = accounts.find(
    (row) =>
      row.id === accountId && (!row.branchId || row.branchId === branchId),
  );
  const linked = links.reduce(
    (sum, row) => sum + (receiptCents(row.amount) ?? BigInt(0)),
    BigInt(0),
  );
  const isFull =
    (receiptCents(amount) ?? BigInt(0)) > BigInt(0) &&
    linked === receiptCents(amount);
  const type = p.allowedTypes.includes("CUSTOMER_RECEIPT")
    ? "CUSTOMER_RECEIPT"
    : "CUSTOMER_ADVANCE";
  const mode =
    selectedAccount?.type === "CASH" || selectedAccount?.type === "PETTY_CASH"
      ? "CASH"
      : "BANK";
  const number =
    (isFull ? review?.receiptNumber : review?.advanceNumber) ??
    "Assigned when saved";
  const payload = {
    idempotencyKey: key,
    type,
    branchId,
    partyId,
    paymentMode: mode,
    moneyAccountId: accountId,
    amount,
    transactionDate: date,
    billingName,
    notes,
    allocations: links.map((row) => ({
      documentId: row.target.slice(9),
      amount: row.amount,
    })),
  };
  const availableCustomers = customers.filter(
    (row) =>
      (!row.branchId || row.branchId === branchId) &&
      (!search ||
        `${row.name} ${row.phone ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        row.id === partyId),
  );
  function selectParty(id: string) {
    setParty(id);
    setBillingName(customers.find((row) => row.id === id)?.name ?? "");
    setLinks([]);
    setKey(crypto.randomUUID());
  }
  async function save(form: FormData) {
    if (pending || creating) return;
    setError("");
    if (!selectedAccount) {
      setError("Select a saved payment account.");
      return;
    }
    if (allocation.error) {
      setError(allocation.error);
      return;
    }
    if (dialog === "links") {
      setError("Confirm or cancel the link review before saving.");
      return;
    }
    setPending(true);
    try {
      if (!uncertain) attempted.current = form;
      const submitted =
        uncertain && attempted.current ? attempted.current : form;
      const result = await saveSettlementWithFeedback(submitted);
      if (result.kind === "error") {
        setError(result.message);
        return;
      }
      setUncertain(false);
      attempted.current = null;
      if (submitted.get("saveMode") === "new") {
        setAmount("");
        setParty("");
        setBillingName("");
        setLinks([]);
        setNotes("");
        setSearch("");
        setKey(crypto.randomUUID());
        setMessage("Receipt saved. Ready for a new payment.");
        router.refresh();
      } else if (result.redirectTo) router.push(result.redirectTo);
    } catch {
      setUncertain(true);
      setError(
        "Unable to confirm saving. Your draft and request reference were kept. Retry the same payment; do not enter it again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <form
        action={save}
        className="stack"
        style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 95 }}
      >
        <header>
          <h1>Payment-In</h1>
          {p.companyName && <p>Firm: {p.companyName}</p>}
        </header>
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        {uncertain && (
          <p role="alert">
            Draft changes are locked until retrying this same receipt confirms
            the result.
          </p>
        )}
        <input type="hidden" name="payload" value={JSON.stringify(payload)} />
        <fieldset disabled={pending || creating || uncertain}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div>
              <label>
                Receipt No.
                <input readOnly value={number} />
              </label>
              <small>
                Preview only; confirmed number is assigned when saved.
              </small>
            </div>
            <label>
              Date
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          {p.branches.length > 1 && (
            <label>
              Branch
              <select
                value={branchId}
                onChange={(e) => {
                  setBranch(e.target.value);
                  setParty("");
                  setBillingName("");
                  setLinks([]);
                  setAccount("");
                  setKey(crypto.randomUUID());
                }}
              >
                {p.branches.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Search saved customers
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or mobile number"
            />
          </label>
          <label>
            Customer Name
            <select
              required
              value={partyId}
              onChange={(e) => selectParty(e.target.value)}
            >
              <option value="">Select customer</option>
              {availableCustomers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                  {row.phone ? ` · ${row.phone}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setError("");
              setDialog("party");
            }}
          >
            + Add New Party
          </button>
          {partyId && (
            <p aria-live="polite">
              Party Balance:{" "}
              {review?.balance != null
                ? formatMoney(review.balance, display)
                : "Loading…"}
            </p>
          )}
          {reviewError && <p role="alert">{reviewError}</p>}
          <label>
            Billing Name (optional)
            <input
              value={billingName}
              maxLength={240}
              onChange={(e) => setBillingName(e.target.value)}
            />
          </label>
          <label>
            Received
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          {partyId && type === "CUSTOMER_RECEIPT" && (
            <button
              type="button"
              onClick={() => {
                setEditLinks(links.map((row) => ({ ...row })));
                setEditAmount(amount);
                setDialog("links");
              }}
            >
              Link
            </button>
          )}
          <p>
            Total Amount: <strong>{formatMoney(amount || "0", display)}</strong>
          </p>
          {partyId && (
            <p>
              Unused credit:{" "}
              {allocation.unused >= BigInt(0)
                ? formatMoney(decimal(allocation.unused), display)
                : "Linked amounts exceed received"}
            </p>
          )}
          <label>
            Payment Type
            <select
              required
              value={accountId}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="">Select account</option>
              {accounts
                .filter((row) => !row.branchId || row.branchId === branchId)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setError("");
              accountKey.current = crypto.randomUUID();
              setDialog("account");
            }}
          >
            + Add Payment Type
          </button>
          <label>
            Description
            <textarea
              maxLength={5000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label>
            Attachment (PDF, PNG or JPEG; 10 MB combined)
            <input
              key={key}
              type="file"
              name="attachments"
              multiple
              accept="application/pdf,image/png,image/jpeg"
            />
          </label>
        </fieldset>
        <button
          id="receipt-preview-submit"
          hidden
          type="submit"
          name="saveMode"
          value="preview"
        />
        <footer
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            maxWidth: 760,
            margin: "0 auto",
            bottom: 0,
            background: "white",
            padding: 12,
            display: "flex",
            gap: 12,
            borderTop: "1px solid #ddd",
            zIndex: 2,
          }}
        >
          <button
            disabled={pending || creating}
            type="submit"
            name="saveMode"
            value="new"
          >
            Save &amp; New
          </button>
          <button
            disabled={pending || creating}
            type="submit"
            name="saveMode"
            value="close"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={pending || creating}
            aria-label="Receipt actions"
            onClick={() => setDialog("menu")}
          >
            ⋮
          </button>
        </footer>
        {dialog === "menu" && (
          <ReviewDialog title="Receipt actions" onClose={() => setDialog(null)}>
            <p>
              Share and Print save this receipt once, then open its authorized
              preview.
            </p>
            <button
              type="button"
              onClick={() => {
                setDialog(null);
                setTimeout(
                  () =>
                    document.getElementById("receipt-preview-submit")?.click(),
                  0,
                );
              }}
            >
              Share
            </button>
            <button
              type="button"
              onClick={() => {
                setDialog(null);
                setTimeout(
                  () =>
                    document.getElementById("receipt-preview-submit")?.click(),
                  0,
                );
              }}
            >
              Print
            </button>
          </ReviewDialog>
        )}
      </form>
      {dialog === "links" && (
        <ReviewDialog
          title="Link Payment To Txns"
          onClose={() => setDialog(null)}
        >
          <label>
            Total Received
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
            />
          </label>
          {docs.length === 0 && (
            <p>No eligible invoices for this customer and branch.</p>
          )}
          {docs.map((doc) => {
            const target = `document:${doc.id}`,
              selected = editLinks.find((row) => row.target === target);
            return (
              <article key={doc.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(selected)}
                    onChange={(e) =>
                      setEditLinks(
                        e.target.checked
                          ? [...editLinks, { target, amount: "" }]
                          : editLinks.filter((row) => row.target !== target),
                      )
                    }
                  />
                  Invoice {doc.documentNumber}
                </label>
                <p>
                  Date:{" "}
                  {doc.issueDate
                    ? formatCalendarDate(doc.issueDate, display)
                    : "—"}{" "}
                  · Original amount:{" "}
                  {formatMoney(doc.grandTotal ?? doc.outstanding, display)} ·
                  Outstanding: {formatMoney(doc.outstanding, display)}
                </p>
                {selected && (
                  <label>
                    Link Amount
                    <input
                      type="number"
                      min="0.01"
                      max={doc.outstanding}
                      step="0.01"
                      value={selected.amount}
                      onChange={(e) =>
                        setEditLinks(
                          editLinks.map((row) =>
                            row.target === target
                              ? { ...row, amount: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                  </label>
                )}
              </article>
            );
          })}
          <p>
            Unused Amount:{" "}
            {editing.unused >= BigInt(0)
              ? formatMoney(decimal(editing.unused), display)
              : "Linked amounts exceed received"}
          </p>
          {editing.error && <p role="alert">{editing.error}</p>}
          <button type="button" onClick={() => setDialog(null)}>
            Cancel
          </button>
          <button
            type="button"
            disabled={Boolean(editing.error)}
            onClick={() => {
              setLinks(editLinks);
              setAmount(editAmount);
              setDialog(null);
            }}
          >
            Done
          </button>
        </ReviewDialog>
      )}
      {(dialog === "party" || dialog === "account") && (
        <ReviewDialog
          title={dialog === "party" ? "Add New Party" : "Add Payment Type"}
          onClose={() => {
            if (!creating) setDialog(null);
          }}
        >
          <form
            className="stack"
            action={async (form) => {
              if (creating) return;
              setCreating(true);
              setError("");
              try {
                if (dialog === "party") {
                  const row = await createSaleCustomerAction(branchId, {
                    name: String(form.get("name")),
                    phone: String(form.get("phone") ?? ""),
                  });
                  setCustomers((rows) => [...rows, row]);
                  setParty(row.id);
                  setBillingName(row.name);
                  setLinks([]);
                } else {
                  const row = await createReceiptMoneyAccount({
                    branchId,
                    name: String(form.get("name")),
                    type: String(form.get("type")),
                    creationRequestKey: accountKey.current,
                  });
                  setAccounts((rows) => [
                    ...rows.filter((item) => item.id !== row.id),
                    row,
                  ]);
                  setAccount(row.id);
                }
                setDialog(null);
                setKey(crypto.randomUUID());
              } catch {
                setError(
                  "Unable to confirm creation. Your receipt draft is intact. Check existing records before retrying.",
                );
              } finally {
                setCreating(false);
              }
            }}
          >
            <label>
              Name
              <input name="name" required maxLength={160} disabled={creating} />
            </label>
            {dialog === "party" ? (
              <label>
                Mobile number
                <input
                  name="phone"
                  type="tel"
                  maxLength={30}
                  disabled={creating}
                />
              </label>
            ) : (
              <label>
                Account type
                <select name="type" disabled={creating}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                </select>
              </label>
            )}
            <button disabled={creating} type="submit">
              {creating ? "Saving…" : "Save and select"}
            </button>
            <button
              disabled={creating}
              type="button"
              onClick={() => setDialog(null)}
            >
              Cancel
            </button>
          </form>
          {error && <p role="alert">{error}</p>}
        </ReviewDialog>
      )}
    </>
  );
}
