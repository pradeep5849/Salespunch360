"use client";
import { useState } from "react";
import { closeYearAction, previewCloseYearAction } from "@/app/actions/account-finalization";
import { SaveFeedbackForm } from "./save-feedback";
export function FinancialYearCloseForm({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [review, setReview] = useState<Awaited<ReturnType<typeof previewCloseYearAction>>|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  return (
    <section>
      <button type="button" disabled={busy} onClick={async () => {setBusy(true);setError("");setReview(null);try{setReview(await previewCloseYearAction(id))}catch{setError("Could not load the close-books review. Check your access and retry.")}finally{setBusy(false)}}}>
        Review closing {name}
      </button>
      {busy&&<p role="status">Checking the year without changing records…</p>}
      {error&&<p role="alert">{error}</p>}
      {review&&<div><p>{review.companyName} · Review: {review.startDate} – {review.endDate}. Current status: {review.status}.</p><p>{review.checkScope}</p><ul>{review.checks.map(check=><li key={check.check}>{check.status}: {check.check} ({check.affected} affected). {check.status!=="PASS"&&check.recommendation}</li>)}</ul>{review.earlyClose&&<p>An early-close reason is required.</p>}<p>Closing retains documents, balances and audit history, and prevents posting through {review.endDate}. Verification runs again when you confirm.</p></div>}
      {review && (
        <SaveFeedbackForm
          action={closeYearAction}
          successMessage="Financial year closed. History is retained and posting is locked."
          errorMessages={{
            EARLY_CLOSE_REASON_REQUIRED:
              "Enter a reason to close before the financial year ends.",
          }}
        >
          <input type="hidden" name="financialYearId" value={id} />
          <p>
            Closing {name} retains its records and locks posting through the
            year’s end. Verification must pass before closing.
          </p>
          <label>
            Early-close reason, if applicable
            <input name="reason" maxLength={2000} required={review.earlyClose} />
          </label>
          <label>
            <input type="checkbox" name="confirmed" required /> I confirm that
            this financial year is ready to close.
          </label>
          <button className="account-danger" disabled={!review.canClose}>
            Confirm & close financial year
          </button>
        </SaveFeedbackForm>
      )}
    </section>
  );
}
