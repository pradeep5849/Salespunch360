"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomFieldDefinition } from "@prisma/client";
import type { PartySettings } from "@/lib/account/party-settings";
import { saveNewAccountPartyAction } from "@/app/actions/account-masters";
import { ActionFeedbackForm, AccountFieldError } from "./action-feedback-form";
import { SavePendingFields, SaveSubmitButton } from "./save-feedback";
import { CustomFieldInput } from "./custom-field-input";
type Field = Pick<
  CustomFieldDefinition,
  "fieldKey" | "label" | "dataType" | "isRequired" | "options"
>;
export function NewAccountPartyForm({
  branches,
  initialBranchId,
  fields,
  settings,
}: {
  branches: Array<{ id: string; name: string }>;
  initialBranchId: string;
  fields: Field[];
  settings: PartySettings;
}) {
  const router = useRouter(),
    [branch, setBranch] = useState(initialBranchId);
  return (
    <ActionFeedbackForm
      action={saveNewAccountPartyAction}
      className="account-form"
      onSuccess={() =>
        router.push(
          `/workspace/account?tab=parties&branchId=${encodeURIComponent(branch)}`,
        )
      }
    >
      <SavePendingFields>
        <label>
          Branch
          <select
            name="branchId"
            aria-label="Branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            required
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <AccountFieldError name="branchId" />
        </label>
        <label>
          Party name
          <input name="name" aria-label="Party name" maxLength={200} required />
          <AccountFieldError name="name" />
        </label>
        <label>
          Contact person
          <input name="contactPerson" maxLength={160} />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" maxLength={30} />
        </label>
        <label>
          Email
          <input name="email" type="email" maxLength={320} />
          <AccountFieldError name="email" />
        </label>
        <label>
          Billing address
          <textarea name="address" maxLength={2000} />
        </label>
        {settings.shippingAddressEnabled && (
          <label>
            Shipping address
            <textarea name="shippingAddress" maxLength={2000} />
          </label>
        )}
        {settings.gstinEnabled && (
          <>
            <label>
              GSTIN
              <input name="gstin" maxLength={15} />
              <AccountFieldError name="gstin" />
            </label>
            <label>
              State code
              <input
                name="stateCode"
                inputMode="numeric"
                pattern="[0-9]{2}"
                maxLength={2}
              />
              <AccountFieldError name="stateCode" />
            </label>
            <label>
              GST registration
              <select name="gstRegistrationType" aria-label="GST registration">
                <option value="UNREGISTERED">Unregistered</option>
                <option value="REGULAR">Regular</option>
                <option value="COMPOSITION">Composition</option>
                <option value="SEZ">SEZ</option>
              </select>
            </label>
            <label>
              PAN
              <input name="pan" maxLength={10} />
              <AccountFieldError name="pan" />
            </label>
          </>
        )}
        <label>
          Notes
          <textarea name="notes" maxLength={2000} />
        </label>
        {fields.map((f) => (
          <CustomFieldInput key={f.fieldKey} field={f} />
        ))}
      </SavePendingFields>
      <SaveSubmitButton disabled={!branch}>Create party</SaveSubmitButton>
    </ActionFeedbackForm>
  );
}
