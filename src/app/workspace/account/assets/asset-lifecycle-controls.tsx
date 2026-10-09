"use client";
import { useState } from "react";
import {
  assignAssetAction,
  assetStatusAction,
  returnAssetAction,
} from "@/app/actions/assets";
import { ActionFeedbackForm } from "@/components/account/action-feedback-form";
import { SaveSubmitButton } from "@/components/account/save-feedback";
export function AssetLifecycleControls({
  id,
  status,
  users,
}: {
  id: string;
  status: string;
  users: { id: string; name: string }[];
}) {
  const [user, setUser] = useState(""),
    [assignmentNotes, setAssignmentNotes] = useState(""),
    [returnNotes, setReturnNotes] = useState(""),
    [target, setTarget] = useState(status);
  return (
    <>
      {["ACTIVE", "ASSIGNED"].includes(status) && (
        <ActionFeedbackForm action={assignAssetAction} className="stack">
          <input type="hidden" name="id" value={id} />
          <label>
            Assign employee
            <select
              name="userId" aria-label="Assign employee"
              required
              value={user}
              onChange={(e) => setUser(e.target.value)}
            >
              <option value="">Select employee</option>
              {users.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assignment notes
            <textarea
              name="notes"
              value={assignmentNotes}
              onChange={(e) => setAssignmentNotes(e.target.value)}
            />
          </label>
          <SaveSubmitButton>
            {status === "ASSIGNED" ? "Reassign asset" : "Assign asset"}
          </SaveSubmitButton>
        </ActionFeedbackForm>
      )}
      {status === "ASSIGNED" && (
        <ActionFeedbackForm action={returnAssetAction} className="stack">
          <input type="hidden" name="id" value={id} />
          <label>
            Return notes
            <textarea
              name="notes"
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
            />
          </label>
          <SaveSubmitButton>Return asset</SaveSubmitButton>
        </ActionFeedbackForm>
      )}
      {!["ASSIGNED", "DISPOSED"].includes(status) && (
        <ActionFeedbackForm action={assetStatusAction} className="stack">
          <input type="hidden" name="id" value={id} />
          <label>
            Asset status
            <select
              name="status" aria-label="Asset status"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {["ACTIVE", "UNDER_MAINTENANCE", "RETIRED", "DISPOSED"].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </label>
          {target === "DISPOSED" && (
            <p>
              A disposed asset cannot be reactivated. Assignment history will be
              retained.
            </p>
          )}
          <SaveSubmitButton>Update status</SaveSubmitButton>
        </ActionFeedbackForm>
      )}
    </>
  );
}
