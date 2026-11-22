"use client";
import { useState, type FormEvent } from "react";
import { savePartyMetadata } from "@/app/actions/party-metadata";
import type {
  PartyKind,
  partyMetadataForEdit,
} from "@/lib/account/party-metadata";
type Context = Awaited<ReturnType<typeof partyMetadataForEdit>>;
export function PartyMetadataForm({
  kind,
  initial,
  settings,
}: {
  kind: PartyKind;
  initial: Context["party"];
  settings: Context["settings"];
}) {
  const [revision, setRevision] = useState(initial.updatedAt),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string | null>(null),
    [stale, setStale] = useState(false);
  const initialValues = {
    name: initial.name,
    contactPerson: initial.contactPerson ?? "",
    phone: initial.phone ?? "",
    email: initial.email ?? "",
    address: initial.address ?? "",
    shippingAddress: initial.shippingAddress ?? "",
    gstin: initial.gstin ?? "",
    stateCode: initial.stateCode ?? "",
    gstRegistrationType: initial.gstRegistrationType,
    pan: initial.pan ?? "",
    notes: initial.notes ?? "",
  };
  const [values, setValues] = useState(initialValues),
    [savedValues, setSavedValues] = useState(initialValues);
  const input = (
    field: keyof typeof values,
    label: string,
    maxLength = 500,
    type = "text",
  ) => (
    <label>
      {label}
      <input
        name={field}
        value={values[field]}
        onChange={(event) =>
          setValues((current) => ({ ...current, [field]: event.target.value }))
        }
        maxLength={maxLength}
        type={type}
        required={field === "name"}
        disabled={busy}
      />
    </label>
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setStale(false);
    const {
      shippingAddress,
      gstin,
      stateCode,
      gstRegistrationType,
      pan,
      ...common
    } = values;
    const selected = {
      ...common,
      ...(kind === "customers" && settings.shippingAddressEnabled
        ? { shippingAddress }
        : {}),
      ...(settings.gstinEnabled
        ? { gstin, stateCode, gstRegistrationType, pan }
        : {}),
    };
    const changed = Object.fromEntries(
      Object.entries(selected).filter(
        ([field, value]) =>
          field === "name" ||
          value !== savedValues[field as keyof typeof savedValues],
      ),
    );
    try {
      const result = await savePartyMetadata(kind, {
        id: initial.id,
        expectedUpdatedAt: revision,
        ...changed,
      });
      if (result.ok) {
        setRevision(result.updatedAt);
        setSavedValues((current) => ({
          ...current,
          ...(changed as Partial<typeof current>),
        }));
        setMessage("Party details saved.");
      } else {
        setStale(result.error === "PARTY_STALE");
        setMessage(
          (
            {
              PARTY_STALE:
                "Saved details changed since this draft was loaded. Your draft is kept; copy it before reloading the latest record.",
              PARTY_NOT_FOUND:
                "This party is no longer available in your scope.",
              FORBIDDEN: "Your current access does not permit this change.",
              INVALID_INPUT: "Check the name, contact and tax details.",
              SAVE_FAILED: "The party could not be saved. Try again.",
            } as Record<string, string>
          )[result.error] ?? "The party could not be saved.",
        );
      }
    } catch {
      setMessage(
        "The request could not complete. Your draft is kept; reconnect and retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form method="post" onSubmit={submit} className="account-master-form">
      <div role="status" aria-live="polite">
        {message}
      </div>
      {stale && (
        <button type="button" onClick={() => window.location.reload()}>
          Reload latest details
        </button>
      )}
      {input("name", "Business name", 200)}
      {input("contactPerson", "Contact person", 160)}
      {input("phone", "Phone", 30, "tel")}
      {input("email", "Email", 320, "email")}
      {input("address", kind === "customers" ? "Billing address" : "Address")}
      {kind === "customers" &&
        settings.shippingAddressEnabled &&
        input("shippingAddress", "Shipping / site address")}
      {settings.gstinEnabled && (
        <>
          {input("gstin", "GSTIN", 15)}
          {input("stateCode", "GST state code", 2)}
          <label>
            GST registration
            <select
              name="gstRegistrationType"
              value={values.gstRegistrationType}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  gstRegistrationType: event.target
                    .value as typeof current.gstRegistrationType,
                }))
              }
              disabled={busy}
            >
              {["UNREGISTERED", "REGULAR", "COMPOSITION", "SEZ"].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </label>
          {input("pan", "PAN", 10)}
        </>
      )}
      {input("notes", "Notes")}
      <button className="primary-button" disabled={busy}>
        {busy ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
