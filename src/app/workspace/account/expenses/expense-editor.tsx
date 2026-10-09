"use client";
import { useEffect, useState } from "react";
import { Prisma } from "@prisma/client";
import {
  ActionFeedbackForm,
  AccountFieldError,
} from "@/components/account/action-feedback-form";
import { SaveSubmitButton } from "@/components/account/save-feedback";
import { ExpenseCategoryForm } from "@/components/account/expense-category-form";
import type { AccountActionResult } from "@/lib/account/action-feedback";
import { expenseTotals } from "@/lib/account/expense-totals";
type Option = {
  id: string;
  name: string;
  branchId?: string | null;
  scope?: string;
  gstStateCode?: string | null;
};
type Line = { name: string; quantity: string; rate: string };
export type ExpenseValue = {
  id: string;
  transactionNumber?: string;
  branchId: string;
  categoryId: string;
  type: string;
  projectId?: string | null;
  moneyAccountId?: string | null;
  transactionDate: string;
  taxableAmount: string;
  billedItems?: Line[] | null;
  additionalCharges?: string;
  roundOffEnabled?: boolean;
  taxRate: string;
  cessRate: string;
  taxMode: "INCLUSIVE" | "EXCLUSIVE";
  taxCreditTreatment: string;
  stateOfSupplyCode?: string | null;
  reference?: string | null;
  notes?: string | null;
};
export type ExpenseEditorOptions = {
  companyName: string;
  defaultTaxMode: "INCLUSIVE" | "EXCLUSIVE";
  defaultStateCode: string;
  compositionEnabled: boolean;
  allowedTypes: string[];
  canCreateCategory: boolean;
  branches: Option[];
  categories: Option[];
  projects: Option[];
  moneyAccounts: Option[];
  ledgers: { id: string; name: string; code: string; accountClass: string }[];
  numbering: {
    branchId: string | null;
    prefix: string;
    suffix: string;
    padding: number;
    nextSequence: string;
  }[];
};
export function ExpenseEditor({
  options: o,
  expense: x,
  action,
  requestKey,
}: {
  options: ExpenseEditorOptions;
  expense?: ExpenseValue;
  action: (f: FormData) => Promise<AccountActionResult>;
  requestKey: string;
}) {
  const [stableKey] = useState(requestKey),
    [branch, setBranch] = useState(x?.branchId ?? o.branches[0]?.id ?? ""),
    [type, setType] = useState(
      x?.type ?? o.allowedTypes[0] ?? "OFFICE_EXPENSE",
    ),
    [category, setCategory] = useState(x?.categoryId ?? ""),
    [newCategoryName, setNewCategoryName] = useState(""),
    [project, setProject] = useState(x?.projectId ?? ""),
    [account, setAccount] = useState(x?.moneyAccountId ?? ""),
    [amount, setAmount] = useState(x?.taxableAmount ?? ""),
    [lines, setLines] = useState<Line[]>(x?.billedItems ?? []),
    [charges, setCharges] = useState(x?.additionalCharges ?? "0"),
    [round, setRound] = useState(x?.roundOffEnabled ?? false),
    [tax, setTax] = useState(x?.taxRate ?? "0"),
    [cess, setCess] = useState(x?.cessRate ?? "0"),
    [gst, setGst] = useState(
      Number(x?.taxRate ?? 0) > 0 || Number(x?.cessRate ?? 0) > 0,
    ),
    [mode, setMode] = useState(x?.taxMode ?? o.defaultTaxMode),
    [credit, setCredit] = useState(x?.taxCreditTreatment ?? "ELIGIBLE"),
    [supply, setSupply] = useState(x?.stateOfSupplyCode ?? ""),
    [inlineCategory, setInlineCategory] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const income = type === "OTHER_INCOME",
    categories = o.categories.filter(
      (c) => c.scope === (income ? "INCOME" : "EXPENSE") || c.scope === "BOTH",
    ),
    categoryId =
      category || categories.find((c) => c.name === newCategoryName)?.id || "",
    branchRecord = o.branches.find((b) => b.id === branch),
    series = o.numbering.find((s) => s.branchId === branch),
    numberPreview = series
      ? `${series.prefix}${String(series.nextSequence).padStart(series.padding, "0")}${series.suffix}`
      : `${income ? "OI-" : "EXP-"}000001`;
  let preview: ReturnType<typeof expenseTotals> | undefined;
  try {
    preview = expenseTotals({
      amount: new Prisma.Decimal(amount || "0"),
      billedItems: lines,
      additionalCharges: charges,
      roundOffEnabled: round,
      taxRate: new Prisma.Decimal(gst && !income ? tax : "0"),
      cessRate: new Prisma.Decimal(gst && !income ? cess : "0"),
      taxMode: mode,
      stateOfSupplyCode:
        supply || branchRecord?.gstStateCode || o.defaultStateCode,
      sellerStateCode: branchRecord?.gstStateCode || o.defaultStateCode,
      composition: o.compositionEnabled,
      itcEligible: credit === "ELIGIBLE",
    });
  } catch {
    /* The server validates incomplete fields on submission. */
  }
  const changeType = (v: string) => {
    setType(v);
    setCategory("");
    setNewCategoryName("");
    if (v === "OTHER_INCOME") {
      setTax("0");
      setCess("0");
      setGst(false);
    }
    if (v !== "PROJECT_EXPENSE") setProject("");
    setDirty(true);
  };
  const select = (
    label: string,
    name: string,
    value: string,
    set: (v: string) => void,
    values: Option[],
    required = false,
    empty = "Select",
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        name={name}
        value={value}
        required={required}
        onChange={(e) => {
          set(e.target.value);
          setDirty(true);
        }}
      >
        <option value="">{empty}</option>
        {values.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <AccountFieldError name={name} />
    </label>
  );
  return (
    <div className="expense-entry">
      <p>Firm: {o.companyName}</p>
      <p>
        {x
          ? `Number: ${x.transactionNumber ?? "Existing draft"}`
          : `Number preview: ${numberPreview}. The server assigns the final number when saved.`}
      </p>
      {inlineCategory && (
        <section aria-label="Create category inline">
          <h2>Add expense / income category</h2>
          <ExpenseCategoryForm
            ledgers={o.ledgers}
            onSaved={(name) => {
              setNewCategoryName(name);
              setCategory("");
              setInlineCategory(false);
            }}
          />
          <button type="button" onClick={() => setInlineCategory(false)}>
            Close category form
          </button>
        </section>
      )}
      <ActionFeedbackForm
        action={action}
        className="stack expense-form"
        onSuccess={() => setDirty(false)}
      >
        {x && <input type="hidden" name="id" value={x.id} />}
        <input type="hidden" name="requestKey" value={stableKey} />
        <label>
          Transaction type
          <select
            aria-label="Transaction type"
            name="type"
            value={type}
            onChange={(e) => changeType(e.target.value)}
          >
            {o.allowedTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        {select(
          "Branch",
          "branchId",
          branch,
          (v) => {
            setBranch(v);
            setProject("");
            setAccount("");
          },
          o.branches,
          true,
        )}
        {select(
          "Category",
          "categoryId",
          categoryId,
          (v) => {
            setCategory(v);
            setNewCategoryName("");
          },
          categories,
          true,
        )}
        {o.canCreateCategory && (
          <button type="button" onClick={() => setInlineCategory(true)}>
            Add expense / income category
          </button>
        )}
        {!categories.length && (
          <p>
            No eligible categories.{" "}
            {o.canCreateCategory
              ? "Add a category above."
              : "Ask an Account administrator to create one."}
          </p>
        )}
        {select(
          "Project",
          "projectId",
          project,
          setProject,
          o.projects.filter((p) => p.branchId === branch),
          type === "PROJECT_EXPENSE",
          "No project",
        )}
        {select(
          "Cash / bank account",
          "moneyAccountId",
          account,
          setAccount,
          o.moneyAccounts.filter((a) => !a.branchId || a.branchId === branch),
          type !== "REIMBURSEMENT",
          type === "REIMBURSEMENT"
            ? "Reimbursement payable"
            : "Select cash / bank account",
        )}
        <label>
          Transaction date
          <input
            type="date"
            name="transactionDate"
            required
            defaultValue={
              x?.transactionDate.slice(0, 10) ??
              new Date().toLocaleDateString("en-CA")
            }
            onChange={() => setDirty(true)}
          />
          <AccountFieldError name="transactionDate" />
        </label>
        <fieldset>
          <legend>Billed items</legend>
          {lines.map((line, i) => (
            <div className="stack" key={i}>
              {(["name", "quantity", "rate"] as const).map((k) => (
                <label key={k}>
                  {`${k} · item ${i + 1}`}
                  <input
                    aria-label={`${k} item ${i + 1}`}
                    value={line[k]}
                    type={k === "name" ? "text" : "number"}
                    min={k === "quantity" ? "0.0001" : "0"}
                    step={k === "quantity" ? "0.0001" : "0.01"}
                    maxLength={k === "name" ? 240 : undefined}
                    required
                    onChange={(e) => {
                      setLines(
                        lines.map((l, j) =>
                          j === i ? { ...l, [k]: e.target.value } : l,
                        ),
                      );
                      setDirty(true);
                    }}
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={() => {
                  setLines(lines.filter((_, j) => j !== i));
                  setDirty(true);
                }}
              >
                Remove item {i + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={lines.length >= 200}
            onClick={() => {
              setLines([...lines, { name: "", quantity: "1", rate: "0" }]);
              setDirty(true);
            }}
          >
            Add billed item
          </button>
          <input
            type="hidden"
            name="billedItems"
            value={JSON.stringify(lines)}
          />
          <AccountFieldError name="billedItems" />
        </fieldset>
        <label>
          {lines.length
            ? "Entered amount (calculated from billed items)"
            : "Entered amount"}
          <input
            name="taxableAmount"
            type="number"
            min="0"
            step="0.01"
            required
            value={lines.length ? "0" : amount}
            readOnly={lines.length > 0}
            onChange={(e) => {
              setAmount(e.target.value);
              setDirty(true);
            }}
          />
          <AccountFieldError name="taxableAmount" />
        </label>
        <label>
          Additional taxable charges
          <input
            name="additionalCharges"
            type="number"
            min="0"
            step="0.01"
            value={charges}
            onChange={(e) => {
              setCharges(e.target.value);
              setDirty(true);
            }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            name="roundOffEnabled"
            checked={round}
            onChange={(e) => {
              setRound(e.target.checked);
              setDirty(true);
            }}
          />
          Round total to nearest rupee
        </label>
        <label>
          <input
            type="checkbox"
            checked={gst && !income}
            disabled={income}
            onChange={(e) => {
              setGst(e.target.checked);
              if (!e.target.checked) {
                setTax("0");
                setCess("0");
              }
              setDirty(true);
            }}
          />
          GST / tax
        </label>
        {income && (
          <p>
            Other Income supports non-taxable entries. GST and CESS remain zero.
          </p>
        )}
        <details open={gst && !income}>
          <summary>Tax settings</summary>
          <label>
            GST rate (%)
            <input
              name="taxRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={gst && !income ? tax : "0"}
              readOnly={!gst || income}
              onChange={(e) => {
                setTax(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <label>
            CESS rate (%)
            <input
              name="cessRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={gst && !income ? cess : "0"}
              readOnly={!gst || income}
              onChange={(e) => {
                setCess(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <label>
            Tax mode
            <select
              aria-label="Tax mode"
              name="taxMode"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as typeof mode);
                setDirty(true);
              }}
            >
              <option>EXCLUSIVE</option>
              <option>INCLUSIVE</option>
            </select>
          </label>
          <label>
            Input tax credit
            <select
              aria-label="Input tax credit"
              name="taxCreditTreatment"
              value={credit}
              onChange={(e) => {
                setCredit(e.target.value);
                setDirty(true);
              }}
            >
              {["ELIGIBLE", "INELIGIBLE", "BLOCKED"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            State of supply code
            <input
              name="stateOfSupplyCode"
              pattern="\d{2}"
              maxLength={2}
              value={supply}
              onChange={(e) => {
                setSupply(e.target.value);
                setDirty(true);
              }}
            />
          </label>
        </details>
        <p role="status" aria-live="polite">
          {preview
            ? `Taxable ₹${preview.taxable.toFixed(2)} · GST/CESS ₹${preview.totalTax.toFixed(2)} · Round off ₹${preview.roundOffAmount.toFixed(2)} · Total ₹${preview.grandTotal.toFixed(2)}`
            : "Complete positive amounts and billed items to preview the total."}
        </p>
        <label>
          Reference
          <input
            name="reference"
            maxLength={160}
            defaultValue={x?.reference ?? ""}
            onChange={() => setDirty(true)}
          />
        </label>
        <label>
          Notes
          <textarea
            aria-label="Notes"
            name="notes"
            maxLength={5000}
            defaultValue={x?.notes ?? ""}
            onChange={() => setDirty(true)}
          />
        </label>
        <SaveSubmitButton>Save draft</SaveSubmitButton>
        {!x && (
          <SaveSubmitButton name="saveMode" value="new">
            Save &amp; New
          </SaveSubmitButton>
        )}
      </ActionFeedbackForm>
    </div>
  );
}
