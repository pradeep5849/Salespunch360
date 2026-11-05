"use client";
import { useState } from "react";
import { closeYearAction } from "@/app/actions/account-finalization";
import { SaveFeedbackForm } from "./save-feedback";
export function FinancialYearCloseForm({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [review, setReview] = useState(false);
  return (
    <section>
      <button type="button" onClick={() => setReview(!review)}>
        Review closing {name}
      </button>
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
            <input name="reason" maxLength={2000} />
          </label>
          <label>
            <input type="checkbox" name="confirmed" required /> I confirm that
            this financial year is ready to close.
          </label>
          <button className="account-danger">
            Verify & close financial year
          </button>
        </SaveFeedbackForm>
      )}
    </section>
  );
}
