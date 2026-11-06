"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Review = {
  id: string;
  companyName: string;
  backupDate: string;
  counts: { model: string; current: number; restored: number }[];
};
export function CompanyRestore() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null),
    [review, setReview] = useState<Review | null>(null),
    [name, setName] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(preview: boolean) {
    if (busy || (preview && !file)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/account/utilities/restore${preview ? "?mode=preview" : ""}`,
        {
          method: "POST",
          headers: {
            "content-type": preview
              ? "application/octet-stream"
              : "application/json",
          },
          body: preview
            ? file
            : JSON.stringify({
                reviewId: review?.id,
                companyName: name,
                confirmed,
              }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Restore could not complete.");
      if (preview) {
        setReview(result);
        setName("");
        setConfirmed(false);
      } else {
        setReview(null);
        setFile(null);
        setMessage(
          "Existing company restored to the saved backup state. Entries and changes after that backup have been removed.",
        );
        router.refresh();
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Restore could not complete.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-card">
      <h2>Restore the existing company</h2>
      <p>
        This replaces company business records with their exact saved backup
        state. Later entries and changes will be removed. It does not create a
        new company.
      </p>
      <p>
        User accounts, login credentials, subscriptions and recovery records are
        retained. Public quotation share links are revoked. Replacement requires the primary company administrator with
        all-branch access.
      </p>
      <label>
        Saved SalesPunch360 backup (JSON, up to 128 MiB)
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setReview(null);
            setError("");
            setConfirmed(false);
            setName("");
          }}
        />
      </label>
      <button
        type="button"
        disabled={!file || busy}
        onClick={() => void submit(true)}
      >
        {busy ? "Working…" : "Validate & preview restore"}
      </button>
      {review && (
        <section>
          <h3>Replacement preview</h3>
          <p>
            Company: <strong>{review.companyName}</strong>
          </p>
          <p>Backup taken: {new Date(review.backupDate).toLocaleString()}</p>
          <details>
            <summary>Current and saved record counts</summary>
            <table>
              <thead>
                <tr>
                  <th>Record type</th>
                  <th>Current</th>
                  <th>After restore</th>
                </tr>
              </thead>
              <tbody>
                {review.counts.map((row) => (
                  <tr key={row.model}>
                    <td>{row.model}</td>
                    <td>{row.current}</td>
                    <td>{row.restored}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <p>
            A private file-inclusive safety copy will be saved before replacing
            any records. If company data changes after this preview, you must
            review again.
          </p>
          <label>
            Type {review.companyName} to confirm
            <input
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />{" "}
            I understand that entries and changes after this backup will be
            removed.
          </label>
          <button
            type="button"
            className="account-danger"
            disabled={busy || !confirmed || name !== review.companyName}
            onClick={() => void submit(false)}
          >
            Replace existing company data
          </button>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
