"use client";
import Link from "next/link";
import { useState } from "react";
import type { AccountActionResult } from "@/lib/account/action-feedback";
import { assetOpeningValue } from "@/lib/account/asset-opening-value";
import {
  ActionFeedbackForm,
  AccountFieldError,
  useAccountFieldError,
} from "@/components/account/action-feedback-form";
import { SaveSubmitButton } from "@/components/account/save-feedback";
export type AssetEditorOptions = {
  branches: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  hsnCodes: string[];
  ledgers: { id: string; name: string; code: string; accountClass: string }[];
  purchases: {
    id: string;
    branchId: string;
    vendorId: string | null;
    documentNumber: string;
    partyName: string;
    lines: { id: string; itemName: string; taxableAmount: string }[];
  }[];
};
export type AssetEditorValue = Record<string, string | number | null>;
function Field({
  name,
  label,
  value,
  set,
  type = "text",
  required = false,
  readOnly = false,
  min,
  max,
  step,
  list,
}: {
  name: string;
  label: string;
  value: string;
  set: (v: string) => void;
  type?: string;
  required?: boolean;
  readOnly?: boolean;
  min?: string;
  max?: string;
  step?: string;
  list?: string;
}) {
  const error = useAccountFieldError(name);
  return (
    <label>
      {label}
      <input
        name={name}
        value={value}
        onChange={(e) => set(e.target.value)}
        type={type}
        required={required}
        readOnly={readOnly}
        min={min}
        max={max}
        step={step}
        list={list}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      <AccountFieldError name={name} />
    </label>
  );
}
export function AssetEditor({
  options,
  asset,
  requestKey,
  action,
}: {
  options: AssetEditorOptions;
  asset?: AssetEditorValue;
  requestKey: string;
  action: (f: FormData) => Promise<AccountActionResult>;
}) {
  const [stableRequestKey] = useState(requestKey);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(asset ?? {}).map(([key, value]) => [
        key,
        value == null ? "" : String(value),
      ]),
    ),
  );
  const get = (name: string, fallback = "") => values[name] ?? fallback;
  const set = (name: string) => (value: string) =>
    setValues((previous) => ({ ...previous, [name]: value }));
  const purchase = options.purchases.find(
      (x) => x.id === get("purchaseDocumentId"),
    ),
    line = purchase?.lines.find((x) => x.id === get("purchaseDocumentLineId"));
  const opening = assetOpeningValue(get("openingQuantity"), get("unitPrice")),
    effectiveValue = line?.taxableAmount ?? opening ?? get("purchaseValue");
  const input = (
    name: string,
    label: string,
    props: Partial<React.ComponentProps<typeof Field>> = {},
  ) => (
    <Field
      name={name}
      label={label}
      value={get(name)}
      set={set(name)}
      {...props}
    />
  );
  const select = (
    name: string,
    label: string,
    rows: { id: string; name: string }[],
    required = false,
    onChange?: (value: string) => void,
  ) => (
    <label>
      {label}
      <select
        name={name}
        aria-label={label}
        value={get(name)}
        required={required}
        onChange={(e) =>
          onChange ? onChange(e.target.value) : set(name)(e.target.value)
        }
      >
        <option value="">{required ? "Select" : "None"}</option>
        {rows.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <AccountFieldError name={name} />
    </label>
  );
  return (
    <ActionFeedbackForm action={action} className="stack asset-form">
      {asset?.id ? (
        <input type="hidden" name="id" value={String(asset.id)} />
      ) : (
        <input type="hidden" name="requestKey" value={stableRequestKey} />
      )}
      {!asset &&
        select("branchId", "Branch", options.branches, true, (value) =>
          setValues((p) => ({
            ...p,
            branchId: value,
            purchaseDocumentId: "",
            purchaseDocumentLineId: "",
          })),
        )}
      <p>
        Asset number:{" "}
        {asset?.assetNumber ?? "Assigned automatically when saved"}
      </p>
      {input("name", "Asset name", { required: true })}
      <label>
        Asset type
        <select
          name="assetType"
          aria-label="Asset type"
          value={get("assetType", "EQUIPMENT")}
          onChange={(e) => set("assetType")(e.target.value)}
        >
          {[
            "VEHICLE",
            "EQUIPMENT",
            "FURNITURE",
            "COMPUTER",
            "TOOL",
            "OTHER",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      {input("category", "Category")}
      {input("hsnCode", "HSN code (4, 6, or 8 digits)", {
        list: "asset-hsn-codes",
      })}
      <datalist id="asset-hsn-codes">
        {options.hsnCodes.map((code) => (
          <option key={code} value={code} />
        ))}
      </datalist>
      <small>
        Suggestions are codes already used in your company; verify the
        classification before saving.
      </small>
      {input("purchaseDate", "Purchase date", { type: "date", required: true })}
      {select("vendorId", "Vendor", options.vendors, false, (value) =>
        setValues((p) => ({
          ...p,
          vendorId: value,
          purchaseDocumentId: "",
          purchaseDocumentLineId: "",
        })),
      )}
      {select(
        "purchaseDocumentId",
        "Posted purchase bill",
        options.purchases
          .filter(
            (x) =>
              x.branchId === get("branchId") &&
              (!get("vendorId") || x.vendorId === get("vendorId")),
          )
          .map((x) => ({
            id: x.id,
            name: `${x.documentNumber} · ${x.partyName}`,
          })),
        false,
        (value) =>
          setValues((p) => ({
            ...p,
            purchaseDocumentId: value,
            purchaseDocumentLineId: "",
          })),
      )}
      {select(
        "purchaseDocumentLineId",
        "Purchase line",
        (purchase?.lines ?? []).map((x) => ({
          id: x.id,
          name: `${x.itemName} · ₹${x.taxableAmount}`,
        })),
      )}
      <Field
        name="purchaseValue"
        label="Effective purchase value"
        value={effectiveValue}
        set={set("purchaseValue")}
        type="number"
        step="0.01"
        min="0"
        required
        readOnly={!!line || opening !== undefined}
      />
      {line && (
        <p>
          Value comes from the selected posted purchase line, excluding tax.
        </p>
      )}
      <fieldset>
        <legend>Opening asset valuation (optional)</legend>
        {input("openingQuantity", "Opening quantity", {
          type: "number",
          min: "0.0001",
          step: "0.0001",
        })}
        {input("unitPrice", "Price per unit", {
          type: "number",
          min: "0",
          step: "0.01",
        })}
        {input("effectiveDate", "As of / effective date", { type: "date" })}
        <p>
          Quantity × unit price sets the opening purchase value. These fields do
          not create inventory stock or a second journal posting.
        </p>
      </fieldset>
      <label>
        Description
        <textarea
          name="description"
          value={get("description")}
          onChange={(e) => set("description")(e.target.value)}
        />
      </label>
      {input("serialNumber", "Serial number")}
      {input("registrationNumber", "Registration number")}
      {input("makeModel", "Make / model")}
      {input("manufactureYear", "Manufacture year", {
        type: "number",
        min: "1900",
        max: "2200",
        step: "1",
      })}
      {input("location", "Location")}
      <label>
        Depreciation method
        <select
          name="depreciationMethod"
          aria-label="Depreciation method"
          value={get("depreciationMethod", "NONE")}
          onChange={(e) => set("depreciationMethod")(e.target.value)}
        >
          {["NONE", "STRAIGHT_LINE", "WRITTEN_DOWN_VALUE"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      {input("usefulLifeMonths", "Useful life in months", {
        type: "number",
        min: "1",
        step: "1",
        required: get("depreciationMethod", "NONE") !== "NONE",
      })}
      <Field
        name="salvageValue"
        label="Salvage value"
        value={get("salvageValue", "0")}
        set={set("salvageValue")}
        type="number"
        min="0"
        step="0.01"
      />
      {input("depreciationStartDate", "Depreciation start date", {
        type: "date",
        required: get("depreciationMethod", "NONE") !== "NONE",
      })}
      {(
        [
          "assetLedgerId",
          "accumulatedDepreciationLedgerId",
          "depreciationExpenseLedgerId",
        ] as const
      ).map((name, i) => (
        <div key={name}>
          {select(
            name,
            [
              "Asset ledger",
              "Accumulated depreciation ledger",
              "Depreciation expense ledger",
            ][i],
            options.ledgers
              .filter((l) => l.accountClass === (i === 2 ? "EXPENSE" : "ASSET"))
              .map((l) => ({ id: l.id, name: `${l.code} · ${l.name}` })),
          )}
        </div>
      ))}
      <div className="button-row">
        <SaveSubmitButton>Save asset</SaveSubmitButton>
        {!asset && (
          <SaveSubmitButton name="saveMode" value="new">
            Save &amp; New
          </SaveSubmitButton>
        )}
        <Link
          href={
            asset?.id
              ? `/workspace/account/assets/${asset.id}`
              : "/workspace/account/assets"
          }
        >
          Cancel
        </Link>
      </div>
    </ActionFeedbackForm>
  );
}
