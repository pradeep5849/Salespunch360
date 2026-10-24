"use client";
import { useId, useRef, useState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { saveChequeFinancialAction } from "@/app/actions/money";
import {useChequeSuccess} from "./cheque-feedback-provider";
import {trapDialogFocus} from "./dialog-keyboard";
import { ActionFeedbackForm, useAccountActionFeedback } from "./action-feedback-form";
import { SavePendingFields, SaveSubmitButton } from "./save-feedback";

function ReopenFeedback(){
 const state=useAccountActionFeedback(),ref=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(state?.kind==="error"&&state.message&&!Object.keys(state.fieldErrors??{}).length)ref.current?.focus()},[state]);
 return state?.kind==="error"&&state.message?<p ref={ref} tabIndex={-1} role="alert">{state.message}</p>:null;
}

function ReopenButtons({ close }: { close: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div data-pending={pending}>
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        disabled={pending}
      >
        Close
      </button>
      <button type="button" onClick={close} disabled={pending}>
        Cancel
      </button>
      <SaveSubmitButton>Yes</SaveSubmitButton>
    </div>
  );
}

export function ChequeFinancialActionForm({
  id,
  version,
  actions,
  accounts,
}: {
  id: string;
  version: number;
  actions: string[];
  accounts: { id: string; name: string }[];
}) {
  const notifySuccess=useChequeSuccess();
  const [action, setAction] = useState(actions[0]);
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId(),trigger=useRef<HTMLButtonElement>(null);
  const close = () => {dialog.current?.close();trigger.current?.focus()};
  const [requestKey] = useState(() => crypto.randomUUID());
  return (
    <ActionFeedbackForm
      action={saveChequeFinancialAction}
      className="stack"
      onSuccess={()=>{notifySuccess("Cheque updated");close()}}
    >
      <SavePendingFields>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="requestKey" value={requestKey} />
      <label>
        Cheque action
        <select
          aria-label="Cheque action"
          name="action"
          value={action}
          onChange={(event) => setAction(event.target.value)}
        >
          {actions.map((value) => (
            <option key={value} value={value}>
              {value === "CLOSE"
                ? "Close cheque"
                : value === "REOPEN"
                  ? "Re-open cheque"
                  : value === "BOUNCE"
                    ? "Record bounced cheque"
                    : "Cancel cheque"}
            </option>
          ))}
        </select>
      </label>
      {action === "REOPEN" ? (
        <>
          <button ref={trigger} type="button" onClick={() => dialog.current?.showModal()}>
            Re-open cheque
          </button>
          <dialog
            ref={dialog}
            aria-labelledby={titleId}
            onKeyDown={trapDialogFocus}
            onCancel={(event) => {
              if (dialog.current?.querySelector('[data-pending="true"]'))
                event.preventDefault();
            }}
            style={{
              width: "min(30rem, calc(100vw - 2rem))",
              maxHeight: "calc(100dvh - 2rem)",
              overflow: "auto",
              borderRadius: "1rem",
              padding: "1.25rem",
            }}
          >
            <h2 id={titleId}>Re-open cheque?</h2>
            <ReopenFeedback/>
            <p>
              This reverses the closure payment and restores the invoice&apos;s
              unpaid balance. The original sale is retained.
            </p>
            <SavePendingFields>
              <label>
                Action date
                <input name="actionDate" type="date" required />
              </label>
              <label>
                Reason
                <textarea name="reason" required maxLength={500} />
              </label>
            </SavePendingFields>
            <ReopenButtons close={close} />
          </dialog>
        </>
      ) : (
        <>
          <label>
            Action date
            <input name="actionDate" type="date" required />
          </label>
          {action === "CLOSE" ? (
            <>
              <label>
                Payment account
                <select
                  aria-label="Payment account"
                  name="moneyAccountId"
                  required
                  defaultValue=""
                >
                  <option value="">Select account</option>
                  {accounts.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Description
                <textarea name="description" maxLength={500} />
              </label>
              <p>
                Closing posts the payment and settles the allocated invoice.
              </p>
            </>
          ) : (
            <>
              <label>
                Reason
                <textarea name="reason" required maxLength={500} />
              </label>
              <p>
                Any closure payment is reversed and the invoice balance is
                restored.
              </p>
            </>
          )}
          <SaveSubmitButton>Confirm cheque action</SaveSubmitButton>
        </>
      )}
      </SavePendingFields>
    </ActionFeedbackForm>
  );
}
