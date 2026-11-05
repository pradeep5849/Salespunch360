"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SaveFeedbackForm } from "./save-feedback";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./tax-settings-reference.module.css";

export type CustomTaxRate = { name: string; rate: number };
export type CustomTaxGroup = {
  name: string;
  rate: number;
  cgst: number;
  sgst: number;
};
type Props = {
  customRates: CustomTaxRate[];
  customGroups: CustomTaxGroup[];
  addRate: (fd: FormData) => Promise<void>;
  addGroup: (fd: FormData) => Promise<void>;
};
const STANDARD_RATES: CustomTaxRate[] = [
  { name: "CGST@0%", rate: 0 },
  { name: "Exempt", rate: 0 },
  { name: "IGST@0%", rate: 0 },
  { name: "SGST@0%", rate: 0 },
  { name: "CGST@0.125%", rate: 0.125 },
  { name: "SGST@0.125%", rate: 0.125 },
  { name: "IGST@0.25%", rate: 0.25 },
  { name: "CGST@1.5%", rate: 1.5 },
  { name: "SGST@1.5%", rate: 1.5 },
  { name: "CGST@2.5%", rate: 2.5 },
  { name: "SGST@2.5%", rate: 2.5 },
  { name: "IGST@3%", rate: 3 },
  { name: "IGST@5%", rate: 5 },
  { name: "CGST@6%", rate: 6 },
  { name: "SGST@6%", rate: 6 },
  { name: "CGST@9%", rate: 9 },
  { name: "SGST@9%", rate: 9 },
  { name: "IGST@12%", rate: 12 },
  { name: "CGST@14%", rate: 14 },
  { name: "SGST@14%", rate: 14 },
  { name: "IGST@18%", rate: 18 },
  { name: "CGST@20%", rate: 20 },
  { name: "SGST@20%", rate: 20 },
  { name: "IGST@28%", rate: 28 },
  { name: "IGST@40%", rate: 40 },
];
const STANDARD_GROUPS: CustomTaxGroup[] = [
  { name: "GST@0%", rate: 0, cgst: 0, sgst: 0 },
  { name: "GST@0.25%", rate: 0.25, cgst: 0.125, sgst: 0.125 },
  { name: "GST@3%", rate: 3, cgst: 1.5, sgst: 1.5 },
  { name: "GST@5%", rate: 5, cgst: 2.5, sgst: 2.5 },
  { name: "GST@12%", rate: 12, cgst: 6, sgst: 6 },
  { name: "GST@18%", rate: 18, cgst: 9, sgst: 9 },
  { name: "GST@28%", rate: 28, cgst: 14, sgst: 14 },
  { name: "GST@40%", rate: 40, cgst: 20, sgst: 20 },
];
const format = (n: number) => (Number.isInteger(n) ? `${n}%` : `${n}%`);
export function TaxListReference({
  customRates,
  customGroups,
  addRate,
  addGroup,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"RATES" | "GROUPS">("RATES"),
    [query, setQuery] = useState(""),
    [dialog, setDialog] = useState(false);
  const rates = useMemo(
    () =>
      [...STANDARD_RATES, ...customRates].filter((x) =>
        x.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [customRates, query],
  );
  const groups = useMemo(
    () =>
      [...STANDARD_GROUPS, ...customGroups].filter((x) =>
        x.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [customGroups, query],
  );
  return (
    <main className={styles.taxList}>
      <div className={styles.taxHeader}>
        <div className={styles.taxTitle}>
          <Link href="/workspace/account/tax/settings" aria-label="Back">
            ←
          </Link>
          <h1>Tax List</h1>
          <button
            type="button"
            onClick={() => {
              const v = prompt("Search tax list", query);
              if (v !== null) setQuery(v);
            }}
            aria-label="Search"
          >
            ⌕
          </button>
        </div>
        <button type="button" onClick={() => router.refresh()}>
          Refresh
        </button>
        <label>
          Search taxes
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className={styles.taxTabs} aria-label="Tax categories">
          <button
            type="button"
            className={tab === "RATES" ? styles.active : ""}
            aria-pressed={tab === "RATES"}
            onClick={() => setTab("RATES")}
          >
            TAX RATES
          </button>
          <button
            type="button"
            className={tab === "GROUPS" ? styles.active : ""}
            aria-pressed={tab === "GROUPS"}
            onClick={() => setTab("GROUPS")}
          >
            TAX GROUPS
          </button>
        </div>
      </div>
      {tab === "RATES"
        ? rates.map((rate, index) => (
            <div className={styles.rateRow} key={`${rate.name}-${index}`}>
              <span>{rate.name}</span>
              <span>{format(rate.rate)}</span>
            </div>
          ))
        : groups.map((group, index) => (
            <div className={styles.groupRow} key={`${group.name}-${index}`}>
              <div className={styles.groupTop}>
                <div className={styles.groupName}>
                  {group.name} : {format(group.rate)}
                </div>
                <span>Saved tax split</span>
              </div>
              <div className={styles.split}>
                <span>
                  SGST@{format(group.sgst)} : {format(group.sgst)}
                </span>
                <span>
                  CGST@{format(group.cgst)} : {format(group.cgst)}
                </span>
              </div>
            </div>
          ))}
      <button
        type="button"
        className={styles.fab}
        onClick={() => setDialog(true)}
        aria-label="Add tax"
      >
        +
      </button>
      {dialog && (
        <TaxEntryDialog
          tab={tab}
          action={tab === "RATES" ? addRate : addGroup}
          close={() => setDialog(false)}
        />
      )}
    </main>
  );
}

function TaxEntryDialog({
  tab,
  action,
  close,
}: {
  tab: "RATES" | "GROUPS";
  action: (fd: FormData) => Promise<void>;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.showModal();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <dialog ref={ref} onCancel={close} aria-labelledby="tax-entry-title">
      <SaveFeedbackForm
        action={action}
        onSuccess={close}
        errorMessages={{
          TAX_CATALOG_FULL:
            "The tax catalogue has reached its 100-entry limit. Edit an existing name to replace that entry.",
          TAX_GROUP_SPLIT_MUST_MATCH_RATE:
            "CGST and SGST must add up to the total rate.",
        }}
      >
        <h2 id="tax-entry-title">
          {tab === "RATES"
            ? "Add or update tax rate"
            : "Add or update tax group"}
        </h2>
        <p>
          Using an existing custom name replaces that entry. Built-in tax rates
          stay unchanged.
        </p>
        <label>
          Name
          <input autoFocus name="name" required maxLength={80} />
        </label>
        <label>
          Rate %
          <input
            name="rate"
            required
            type="number"
            min="0"
            max="100"
            step="0.001"
          />
        </label>
        {tab === "GROUPS" && (
          <>
            <label>
              CGST %
              <input
                name="cgst"
                required
                type="number"
                min="0"
                max="100"
                step="0.001"
              />
            </label>
            <label>
              SGST %
              <input
                name="sgst"
                required
                type="number"
                min="0"
                max="100"
                step="0.001"
              />
            </label>
          </>
        )}
        <button type="button" onClick={close}>
          Cancel
        </button>
        <button type="submit">Save</button>
      </SaveFeedbackForm>
    </dialog>
  );
}
