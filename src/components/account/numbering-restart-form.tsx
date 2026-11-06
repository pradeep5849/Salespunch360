"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Option = {
  id: string;
  type: string;
  branch: string;
  prefix: string;
  nextSequence: string;
};
type Review = {
  token: string;
  type: string;
  branch: string;
  previousPrefix: string;
  previousNextSequence: string;
  prefix: string;
  examples: string[];
  expiresAt: string;
};
export function NumberingRestartForm({ options }: { options: Option[] }) {
  const router = useRouter();
  const [seriesId, setSeries] = useState(options[0]?.id ?? ""),
    [prefix, setPrefix] = useState(""),
    [reason, setReason] = useState(""),
    [review, setReview] = useState<Review | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function send(action: "PREVIEW" | "CONFIRM") {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/numbering-restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          input:
            action === "PREVIEW"
              ? { seriesId, prefix, reason }
              : { token: review?.token, confirmed },
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message ?? "Could not update numbering.");
      if (action === "PREVIEW") {
        setReview(data);
        setConfirmed(false);
      } else {
        setReview(null);
        setMessage(
          "Future numbering restarted. Existing documents and their numbers are unchanged.",
        );
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update numbering. No success was confirmed.",
      );
    } finally {
      setBusy(false);
    }
  }
  function edit() {
    setReview(null);
    setConfirmed(false);
    setMessage("");
  }
  return (
    <section>
      <p>
        This changes future numbering for one active branch series. It does not
        close a financial year, delete transactions or alter issued document
        numbers. A completely unused prefix is required.
      </p>
      <label>
        Branch and document series
        <select
          value={seriesId}
          disabled={busy}
          onChange={(e) => {
            setSeries(e.target.value);
            edit();
          }}
        >
          {options.map((x) => (
            <option key={x.id} value={x.id}>
              {x.branch} · {x.type.replaceAll("_", " ")} · {x.prefix}
              {x.nextSequence}
            </option>
          ))}
        </select>
      </label>
      <label>
        New prefix
        <input
          value={prefix}
          maxLength={30}
          disabled={busy}
          placeholder="FY2026-SI/"
          onChange={(e) => {
            setPrefix(e.target.value);
            edit();
          }}
        />
      </label>
      <label>
        Reason
        <input
          value={reason}
          minLength={5}
          maxLength={500}
          disabled={busy}
          onChange={(e) => {
            setReason(e.target.value);
            edit();
          }}
        />
      </label>
      <button
        type="button"
        disabled={busy || !seriesId}
        onClick={() => send("PREVIEW")}
      >
        Preview numbering restart
      </button>
      {review && (
        <section aria-label="Numbering restart review">
          <h2>Review future numbers</h2>
          <p>
            {review.branch} · {review.type.replaceAll("_", " ")}
          </p>
          <p>
            Previous prefix: {review.previousPrefix || "none"}; next sequence:{" "}
            {review.previousNextSequence}.
          </p>
          <p>New sequence begins at 1 with prefix {review.prefix}:</p>
          <ul>
            {review.examples.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p>
            Preview expires at {new Date(review.expiresAt).toLocaleString()} and
            will be rechecked before saving.
          </p>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm this restart applies only to future documents.
          </label>
          <button
            type="button"
            className="account-danger"
            disabled={busy || !confirmed}
            onClick={() => send("CONFIRM")}
          >
            {busy ? "Saving…" : "Confirm numbering restart"}
          </button>
        </section>
      )}
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
      {!options.length && (
        <p>
          No active supported numbering series are available. Create the
          relevant document normally to establish its series first.
        </p>
      )}
    </section>
  );
}
