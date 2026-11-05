"use client";
import Link from "next/link";
import { useState } from "react";
import { SaveFeedbackForm } from "./save-feedback";
import { SettingsInfoDialog, type SettingsInfo } from "./settings-info-dialog";
import styles from "./tax-settings-reference.module.css";
export type TaxPreferences = {
  gst?: boolean;
  hsnSac?: boolean;
  additionalCess?: boolean;
  reverseCharge?: boolean;
  stateOfSupply?: boolean;
  ewayBillNumber?: boolean;
  compositeScheme?: boolean;
  enableTcs?: boolean;
  enableTds?: boolean;
  compositionCategory?: "MANUFACTURING" | "TRADER_GOODS" | "RESTAURANT";
};
const fields = [
  [
    "gst",
    "GST",
    "Controls GST fields and tax calculation defaults for new transactions.",
  ],
  [
    "hsnSac",
    "HSN/SAC Code",
    "Shows goods and service classification codes on item entry.",
  ],
  [
    "additionalCess",
    "Additional CESS",
    "Allows the additional cess component where applicable.",
  ],
  [
    "reverseCharge",
    "Reverse Charge",
    "Allows applicable transactions to record reverse-charge tax treatment.",
  ],
  [
    "stateOfSupply",
    "State of Supply",
    "Shows the supply state used to distinguish intra-state and inter-state GST.",
  ],
  [
    "ewayBillNumber",
    "E-Way Bill No.",
    "Allows recording an externally generated e-way bill number. This does not generate a government e-way bill.",
  ],
  [
    "compositeScheme",
    "Composite Scheme",
    "Uses composition treatment for new transactions. Choose your business category when enabling this setting.",
  ],
  [
    "enableTcs",
    "Enable TCS",
    "Allows tax collected at source on new transactions. Enter an applicable rate when preparing the transaction.",
  ],
  [
    "enableTds",
    "Enable TDS",
    "Allows tax deducted at source on new transactions. Enter an applicable rate when preparing the transaction.",
  ],
] as const;
export function TaxSettingsReference({
  values,
  action,
}: {
  values: TaxPreferences;
  action: (fd: FormData) => Promise<void>;
}) {
  const [query, setQuery] = useState(""),
    [info, setInfo] = useState<SettingsInfo | null>(null),
    [prefs, setPrefs] = useState(values);
  return (
    <main className={styles.root}>
      <header className={styles.header}>
        <Link href="/workspace/account/settings" aria-label="Back">
          ←
        </Link>
        <h1>Taxes &amp; GST</h1>
      </header>
      <label>
        Search settings
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <Link className={styles.linkRow} href="/workspace/account/tax/list">
        Tax List ›
      </Link>
      <SaveFeedbackForm
        action={action}
        successMessage="Tax settings saved. Posted transactions are unchanged."
        errorMessages={{
          COMPOSITION_CATEGORY_REQUIRED:
            "Select your composition business category.",
        }}
      >
        {fields.map(([key, label, what]) => (
          <div
            key={key}
            hidden={!label.toLowerCase().includes(query.toLowerCase())}
          >
            <label className={styles.row}>
              <span>{label}</span>
              <input
                className={styles.switch}
                type="checkbox"
                name={key}
                checked={Boolean(prefs[key])}
                onChange={(event) =>
                  setPrefs({ ...prefs, [key]: event.target.checked })
                }
              />
            </label>
            <button
              type="button"
              aria-label={`About ${label}`}
              onClick={() =>
                setInfo({
                  title: label,
                  what,
                  why: "Choose the treatment that applies to your business. Saved historical tax amounts remain unchanged.",
                })
              }
            >
              ⓘ {label}
            </button>
          </div>
        ))}
        <label>
          Composition business category
          <select
            name="compositionCategory"
            required={Boolean(prefs.compositeScheme)}
            value={prefs.compositionCategory ?? ""}
            onChange={(event) =>
              setPrefs({
                ...prefs,
                compositionCategory: event.target
                  .value as TaxPreferences["compositionCategory"],
              })
            }
          >
            <option value="">Select category</option>
            <option value="MANUFACTURING">Manufacturing</option>
            <option value="TRADER_GOODS">Trader Goods</option>
            <option value="RESTAURANT">Restaurant</option>
          </select>
        </label>
        {prefs.enableTcs && (
          <Link href="/workspace/account/tax/list">Manage TCS rates</Link>
        )}
        <button className="account-primary" type="submit">
          Save tax settings
        </button>
      </SaveFeedbackForm>
      <SettingsInfoDialog info={info} onClose={() => setInfo(null)} />
    </main>
  );
}
