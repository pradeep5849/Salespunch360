"use client";
import { useState, type FormEvent } from "react";
import { saveItemMetadata } from "@/app/actions/item-metadata";
import type {
  ItemKind,
  itemMetadataForEdit,
} from "@/lib/account/item-metadata";
type Initial = Awaited<ReturnType<typeof itemMetadataForEdit>>;
export function ItemMetadataForm({
  kind,
  initial,
}: {
  kind: ItemKind;
  initial: Initial;
}) {
  const [values, setValues] = useState({
    name: initial.name,
    code: initial.code,
    description: initial.description,
    sellingRate: initial.sellingRate,
    taxRate: initial.taxRate ?? "",
  });
  const [saved, setSaved] = useState(values),
    [revision, setRevision] = useState(initial.updatedAt),
    [busy, setBusy] = useState(false),
    [stale, setStale] = useState(false),
    [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || stale) return;
    setBusy(true);
    setMessage("");
    const patch = Object.fromEntries(
      Object.entries(values).filter(
        ([key, value]) =>
          key === "name" || value !== saved[key as keyof typeof saved],
      ),
    );
    if (initial.taxRate === null) delete patch.taxRate;
    try {
      const result = await saveItemMetadata(kind, {
        id: initial.id,
        expectedUpdatedAt: revision,
        ...patch,
      });
      if (result.ok) {
        setRevision(result.updatedAt);
        setSaved({ ...values });
        setMessage("Item details saved.");
      } else {
        setStale(result.error === "ITEM_STALE");
        setMessage(
          result.error === "ITEM_STALE"
            ? "This item changed or is no longer available. Reload before editing again."
            : result.error === "INVALID_INPUT"
              ? "Check the name, code and amounts. Rates must be non-negative with at most two decimal places; tax cannot exceed 100%."
              : result.error === "FORBIDDEN"
                ? "You no longer have permission to edit this item."
                : "Unable to save. Check your connection and try again.",
        );
      }
    } catch {
      setMessage(
        "Save could not be confirmed. Reload this item before retrying.",
      );
      setStale(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="account-form">
      {(
        [
          ["name", "Name", 200],
          ["code", "Code", 60],
          ["description", "Description", 2000],
          ["sellingRate", "Sale rate (tax exclusive)", 17],
          ...(initial.taxRate !== null ? [["taxRate", "Tax rate (%)", 6]] : []),
        ] as [keyof typeof values, string, number][]
      ).map(([field, label, max]) => (
        <label key={field}>
          {label}
          <input
            name={field}
            value={values[field]}
            maxLength={max}
            required={
              field === "name" ||
              (field === "sellingRate" && saved.sellingRate !== "") ||
              (field === "taxRate" && saved.taxRate !== "")
            }
            inputMode={
              field === "sellingRate" || field === "taxRate"
                ? "decimal"
                : undefined
            }
            disabled={busy || stale}
            onChange={(e) =>
              setValues((v) => ({ ...v, [field]: e.target.value }))
            }
          />
        </label>
      ))}
      <button disabled={busy || stale} type="submit">
        {busy ? "Saving…" : "Save changes"}
      </button>
      {stale && (
        <button type="button" onClick={() => window.location.reload()}>
          Reload item
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
