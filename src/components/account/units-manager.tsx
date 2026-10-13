"use client";
import Link from "next/link";
import {UnitAssignmentDialog} from "./unit-assignment-dialog";
import {validUnitConversionRate} from "@/lib/account/unit-conversion-rate";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  createAccountUnitAction,
  updateAccountUnitAction,
  saveUnitConversionAction,
} from "@/app/actions/account-masters";
type Unit = { id: string; name: string; symbol: string; itemCount: number };
type Conv = {
  baseUnitId: string;
  secondaryUnitId: string;
  rate: string | number;
};
export function UnitsManager({
  units: initial,
  conversions: initialConversions,
}: {
  units: Unit[];
  conversions: Conv[];
}) {
  const [units, setUnits] = useState(initial),
    [assignmentOpen,setAssignmentOpen]=useState(false),
    [assignmentMessage,setAssignmentMessage]=useState(""),
    [q, setQ] = useState(""),
    [open, setOpen] = useState(false),
    [edit, setEdit] = useState<Unit | null>(null),
    [name, setName] = useState(""),
    [symbol, setSymbol] = useState(""),
    [conversionOpen, setConversionOpen] = useState(false),
    [base, setBase] = useState(""),
    [secondary, setSecondary] = useState(""),
    [rate, setRate] = useState("1"),
    [conversions, setConversions] = useState(initialConversions),
    [pending, startTransition] = useTransition(),
    [error, setError] = useState("");
  const unitDialog = useRef<HTMLDialogElement>(null),
    conversionDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = unitDialog.current;
    if (open && !element?.open) {
      element?.showModal();
      element?.querySelector("input")?.focus();
    } else if (!open) element?.close();
  }, [open]);
  useEffect(() => {
    const element = conversionDialog.current;
    if (conversionOpen && !element?.open) element?.showModal();
    else if (!conversionOpen) element?.close();
  }, [conversionOpen]);
  const visible = useMemo(
    () =>
      units.filter((x) =>
        `${x.name} ${x.symbol}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [units, q],
  );
  const beginAdd = () => {
    setEdit(null);
    setName("");
    setSymbol("");
    setError("");
    setOpen(true);
  };
  const beginEdit = (u: Unit) => {
    setEdit(u);
    setName(u.name);
    setSymbol(u.symbol);
    setError("");
    setOpen(true);
  };
  const saveUnit = () => {
    if (pending || !name.trim() || !symbol.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        const row = edit
          ? await updateAccountUnitAction(edit.id, {
              name: name.trim(),
              symbol: symbol.trim(),
            })
          : await createAccountUnitAction({
              name: name.trim(),
              symbol: symbol.trim(),
            });
        if (!row.ok) {
          setError(row.message);
          return;
        }
        setUnits((old) => {
          const rest = old.filter((x) => x.id !== row.id);
          return [
            ...rest,
            {
              id: row.id,
              name: row.name,
              symbol: row.symbol,
              itemCount: edit?.itemCount ?? 0,
            },
          ].sort((a, b) => a.name.localeCompare(b.name));
        });
        setOpen(false);
      } catch {
        setError("The unit could not be saved. Retry when connected.");
      }
    });
  };
  const saveConversion = () => {
    if (
      pending ||
      !base ||
      !secondary ||
      base === secondary ||
      !validUnitConversionRate(rate)
    )
      return;
    setError("");
    startTransition(async () => {
      try {
        const result = await saveUnitConversionAction({
          baseUnitId: base,
          secondaryUnitId: secondary,
          rate,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        const n = rate.trim();
        setConversions((old) => [
          ...old.filter(
            (x) => !(x.baseUnitId === base && x.secondaryUnitId === secondary),
          ),
          { baseUnitId: base, secondaryUnitId: secondary, rate: n },
        ]);
        setConversionOpen(false);
      } catch {
        setError("The conversion could not be saved. Retry when connected.");
      }
    });
  };
  const conversionFor = (id: string) =>
    conversions.find((x) => x.baseUnitId === id || x.secondaryUnitId === id);
  return (
    <section className="items-manager-page" aria-labelledby="units-page-title">
      <header className="items-manager-header">
        <Link href="/workspace/account/inventory" aria-label="Back to Items">
          ←
        </Link>
        <h1 id="units-page-title">Units</h1>
        <Link
          href="/workspace/account/inventory/item-settings"
          aria-label="Item settings"
        >
          ⚙
        </Link>
      </header>
      <nav className="items-section-tabs" aria-label="Items sections">
        <Link href="/workspace/account/inventory/catalog?type=PRODUCT">
          Products
        </Link>
        <Link href="/workspace/account/inventory/catalog?type=SERVICE">
          Services
        </Link>
        <Link href="/workspace/account/inventory/categories">Categories</Link>
        <Link href="/workspace/account/inventory/units" aria-current="page">
          Units
        </Link>
      </nav>
      <div className="manager-search">
        ⌕
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search Unit"
          placeholder="Search Unit"
        />
      </div>
      <div className="unit-top-actions">
        <button
          onClick={() => {
            setBase(units[0]?.id ?? "");
            setSecondary(units[1]?.id ?? "");
            setRate("1");
            setError("");
            setConversionOpen(true);
          }}
        >
          Set Conversion
        </button>
        <button disabled={pending} onClick={()=>{setAssignmentMessage("");setAssignmentOpen(true);}} title="Unit to Items">
          Unit to Items
        </button>
      </div>
      {assignmentMessage&&<p role="status">{assignmentMessage}</p>}
      {assignmentOpen&&<UnitAssignmentDialog units={units} onClose={()=>setAssignmentOpen(false)} onSaved={(changed,count)=>{setUnits(old=>{const next=old.map(unit=>changed.find(row=>row.id===unit.id)??unit);return [...next,...changed.filter(unit=>!old.some(row=>row.id===unit.id))];});setAssignmentMessage(`Assigned unit to ${count} items.`);}}/>}
      {visible.length === 0 && (
        <p role="status">
          {units.length === 0
            ? "No units have been added yet."
            : "No units match your search."}
        </p>
      )}
      <div className="unit-list">
        {visible.map((u) => {
          const conv = conversionFor(u.id);
          return (
            <div className="unit-row" key={u.id}>
              <div>
                <strong>{u.name.toUpperCase()}</strong>
                <small>{u.symbol}</small>
                {conv && (
                  <em>
                    {conv.baseUnitId === u.id
                      ? `1 ${u.symbol} = ${conv.rate} ${units.find((x) => x.id === conv.secondaryUnitId)?.symbol ?? ""}`
                      : `Used in conversion`}
                  </em>
                )}
              </div>
              {conv && <span>⌄</span>}
              <button
                onClick={() => beginEdit(u)}
                aria-label={`Edit ${u.name}`}
              >
                ✎
              </button>
            </div>
          );
        })}
      </div>
      <button className="manager-fab" onClick={beginAdd}>
        ⊕ Add Unit
      </button>
      <dialog
        ref={unitDialog}
        className="items-modal"
        aria-labelledby="unit-editor-title"
        onCancel={(event) => {
          if (pending) event.preventDefault();
          else setOpen(false);
        }}
      >
        <section>
          <header>
            <h2 id="unit-editor-title">{edit ? "Edit Unit" : "Add Unit"}</h2>
            <button
              disabled={pending}
              onClick={() => setOpen(false)}
              aria-label="Close unit editor"
            >
              ×
            </button>
          </header>
          <div className="manager-sheet-body">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              aria-label="Full Unit Name"
              maxLength={80}
              placeholder="Enter Full Unit Name"
            />
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              disabled={pending}
              aria-label="Short Name"
              maxLength={20}
              placeholder="Short Name"
            />
            {error && <p role="alert">{error}</p>}
            <div className="manager-sheet-actions">
              <button disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
              <button
                disabled={!name.trim() || !symbol.trim() || pending}
                onClick={saveUnit}
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </section>
      </dialog>
      <dialog
        ref={conversionDialog}
        className="items-modal units-conversion"
        aria-labelledby="unit-conversion-title"
        onCancel={(event) => {
          if (pending) event.preventDefault();
          else setConversionOpen(false);
        }}
      >
        <header className="items-manager-header">
          <button
            disabled={pending}
            onClick={() => setConversionOpen(false)}
            aria-label="Back to Units"
          >
            ←
          </button>
          <h2 id="unit-conversion-title">Set Conversion</h2>
          <span />
        </header>
        <div className="conversion-body">
          <label>
            Base unit
            <select disabled={pending} aria-label="Base unit" value={base} onChange={(e) => setBase(e.target.value)}>
              {units.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.name.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Secondary unit
            <select
              aria-label="Secondary unit"
              disabled={pending}
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
            >
              {units.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.name.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Conversion Rate
            <input
              aria-label="Conversion Rate"
              aria-invalid={!!rate&&!validUnitConversionRate(rate)}
              aria-describedby={rate&&!validUnitConversionRate(rate)?"unit-conversion-rate-error":undefined}
              disabled={pending}
              type="number"
              min=".0001"
              step=".0001"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
          {rate&&!validUnitConversionRate(rate)&&<p id="unit-conversion-rate-error" role="status">Enter a positive rate with up to 14 whole and 4 decimal digits.</p>}
          {error && <p role="alert">{error}</p>}
          <p>
            ⓘ 1 {units.find((x) => x.id === base)?.name.toUpperCase() ?? "BASE"}{" "}
            = {rate || "0"}{" "}
            {units.find((x) => x.id === secondary)?.name.toUpperCase() ??
              "SECONDARY"}
          </p>
        </div>
        <footer className="manager-bottom-actions">
          <button disabled={pending} onClick={() => setConversionOpen(false)}>Cancel</button>
          <button
            disabled={
              !base ||
              !secondary ||
              base === secondary ||
              !validUnitConversionRate(rate) ||
              pending
            }
            onClick={saveConversion}
          >
            Save
          </button>
        </footer>
      </dialog>
    </section>
  );
}
