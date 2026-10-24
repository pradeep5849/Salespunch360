"use client";
import Link from "next/link";
import {
  stockDecimalCompare,
  stockDecimalFormat,
  stockDecimalSum,
} from "@/lib/account/stock-display-decimal";
import { ClientMoney, useDisplayPreferences } from "./display-preferences";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountIcon } from "./account-icons";
type Row = {
  id: string;
  name: string;
  category: string;
  active: boolean;
  threshold: string;
  quantity: string;
  value: string;
};

export function StockSummary({
  rows,
  asOf,
  contextQuery = {},
  initialFilters = {},
}: {
  rows: Row[];
  asOf: string;
  contextQuery?: { branchId?: string; scope?: string };
  initialFilters?: {
    q?: string;
    category?: string;
    level?: string;
    status?: string;
  };
}) {
  const router = useRouter();
  const display = useDisplayPreferences();
  const [q, setQ] = useState(initialFilters.q ?? "");
  const [category, setCategory] = useState(initialFilters.category ?? "");
  const [level, setLevel] = useState(initialFilters.level ?? "");
  const [active, setActive] = useState(initialFilters.status ?? "");
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState({ category: "", level: "", active: "" });
  const [sharing, setSharing] = useState(false),
    [shareMessage, setShareMessage] = useState("");
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q.toLowerCase()) &&
          (!category || r.category === category) &&
          (!active || String(r.active) === active) &&
          (!level ||
            (level === "negative"
              ? stockDecimalCompare(r.quantity, "0") < 0
              : level === "low"
                ? stockDecimalCompare(r.quantity, r.threshold) <= 0
                : stockDecimalCompare(r.quantity, r.threshold) > 0)),
      ),
    [rows, q, category, level, active],
  );
  const categories = [...new Set(rows.map((r) => r.category))],
    exportQuery = new URLSearchParams({
      ...contextQuery,
      ...(q ? { q } : {}),
      ...(category ? { category } : {}),
      ...(level ? { level } : {}),
      ...(active ? { status: active } : {}),
      ...(asOf ? { asOf } : {}),
    }).toString();
  async function shareReport() {
    if (sharing) return;
    setSharing(true);
    setShareMessage("");
    try {
      const response = await fetch(
        `/api/account/inventory/stock-summary/pdf?${exportQuery}`,
      );
      if (!response.ok) throw new Error("EXPORT_FAILED");
      const file = new File([await response.blob()], "stock-summary.pdf", {
        type: "application/pdf",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Stock Summary" });
        setShareMessage("Report handed to the sharing app.");
      } else {
        const url = URL.createObjectURL(file),
          link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        setShareMessage("PDF downloaded. Attach it to your message manually.");
      }
    } catch (error) {
      setShareMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "Sharing cancelled."
          : "The report could not be shared. Try again.",
      );
    } finally {
      setSharing(false);
    }
  }
  return (
    <div className="account-stock-summary">
      <header className="account-stock-header">
        <Link href="/workspace/account/inventory" aria-label="Back to Items">
          ←
        </Link>
        <h1>Stock Summary</h1>
        <a
          aria-label="Download stock summary PDF"
          href={`/api/account/inventory/stock-summary/pdf?${exportQuery}`}
        >
          PDF
        </a>
        <a
          aria-label="Download stock summary Excel workbook"
          href={`/api/account/inventory/stock-summary/xlsx?${exportQuery}`}
        >
          Excel
        </a>
        <button type="button" disabled={sharing} onClick={shareReport}>
          {sharing ? "Preparing…" : "Share report"}
        </button>
      </header>
      {shareMessage && <p role="status">{shareMessage}</p>}
      <div className="account-compact-search">
        <AccountIcon name="search" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search stock"
          placeholder="Search stock"
        />
      </div>
      <form
        className="account-asof"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          router.push(
            `/workspace/account/inventory/stock-summary?${new URLSearchParams({ ...contextQuery, ...(q ? { q } : {}), ...(category ? { category } : {}), ...(level ? { level } : {}), ...(active ? { status: active } : {}), ...(data.get("enabled") ? { asOf: String(data.get("asOf") ?? "") } : {}) }).toString()}`,
          );
        }}
      >
        <label>
          <input
            name="enabled"
            type="checkbox"
            defaultChecked={Boolean(asOf)}
          />{" "}
          Show stock as on date
        </label>
        <input
          aria-label="Stock as-of date"
          name="asOf"
          type="date"
          defaultValue={asOf || new Date().toISOString().slice(0, 10)}
        />
        <button>Apply</button>
      </form>
      <button
        type="button"
        onClick={() => {
          setDraft({ category, level, active });
          dialog.current?.showModal();
        }}
      >
        Filters
      </button>
      <dialog
        ref={dialog}
        className="items-modal"
        aria-labelledby="stock-filter-title"
      >
        <section className="items-filter-sheet">
          <header>
            <h2 id="stock-filter-title">Filter By</h2>
            <button
              type="button"
              aria-label="Close stock filters"
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="account-stock-filters">
            <select
              aria-label="Item category"
              value={draft.category}
              onChange={(e) =>
                setDraft((previous) => ({
                  ...previous,
                  category: e.target.value,
                }))
              }
            >
              <option value="">All categories</option>
              {categories.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              aria-label="Stock level"
              value={draft.level}
              onChange={(e) =>
                setDraft((previous) => ({ ...previous, level: e.target.value }))
              }
            >
              <option value="">All stock levels</option>
              <option value="available">Available</option>
              <option value="low">Low stock</option>
              <option value="negative">Negative</option>
            </select>
            <select
              aria-label="Item status"
              value={draft.active}
              onChange={(e) =>
                setDraft((previous) => ({
                  ...previous,
                  active: e.target.value,
                }))
              }
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <footer>
            <button
              type="button"
              onClick={() => setDraft({ category: "", level: "", active: "" })}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                setCategory(draft.category);
                setLevel(draft.level);
                setActive(draft.active);
                dialog.current?.close();
              }}
            >
              Apply filters
            </button>
          </footer>
        </section>
      </dialog>
      <div className="account-filter-chips">
        {[
          [category, setCategory],
          [level, setLevel],
          [active, setActive],
        ]
          .filter((x) => x[0])
          .map(([value, set], i) => (
            <button
              key={i}
              onClick={() => typeof set === "function" && set("")}
            >
              {String(value)} ×
            </button>
          ))}
      </div>
      <section className="account-stat-grid">
        <article className="account-card">
          <small>Number of Items</small>
          <strong>{filtered.length}</strong>
        </article>
        <article className="account-card">
          <small>Low Stock Items</small>
          <strong>
            {
              filtered.filter(
                (r) => stockDecimalCompare(r.quantity, r.threshold) <= 0,
              ).length
            }
          </strong>
        </article>
        <article className="account-card">
          <small>Total Stock Value</small>
          <strong>
            <ClientMoney
              value={stockDecimalSum(filtered.map((row) => row.value))}
            />
          </strong>
        </article>
      </section>
      <section className="account-item-list">
        {filtered.length === 0 && (
          <div role="status">
            <p>
              {rows.length === 0
                ? "No inventory items are available in this branch."
                : "No stock items match these filters."}
            </p>
            <button
              type="button"
              onClick={() => {
                setQ("");
                setCategory("");
                setLevel("");
                setActive("");
              }}
            >
              Reset filters
            </button>
          </div>
        )}
        {filtered.map((r) => (
          <article className="account-item-card" key={r.id}>
            <div>
              <h2>{r.name}</h2>
              <span className="account-category">{r.category}</span>
            </div>
            <dl>
              <div>
                <dt>Stock value</dt>
                <dd>
                  <ClientMoney value={String(r.value)} />
                </dd>
              </div>
              <div>
                <dt>Stock quantity</dt>
                <dd
                  className={
                    stockDecimalCompare(r.quantity, "0") < 0
                      ? "negative"
                      : undefined
                  }
                >
                  {stockDecimalFormat(r.quantity, display.displayDecimalPlaces)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </div>
  );
}
