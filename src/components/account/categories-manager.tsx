"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createCategoryWithFeedbackAction } from "@/app/actions/account-masters";

export function CategoriesManager({
  categories: initial,
  uncategorizedCount,
}: {
  categories: { id: string; name: string; count: number }[];
  uncategorizedCount: number;
}) {
  const [rows, setRows] = useState(initial),
    [q, setQ] = useState(""),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [error, setError] = useState<string | null>(null),
    [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const visible = useMemo(
    () => rows.filter((x) => x.name.toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  const create = () => {
    if (!name.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createCategoryWithFeedbackAction({
          name: name.trim(),
          scope: "BOTH",
        });
        if (result.kind === "error") {
          setError(result.message);
          return;
        }
        setRows((old) =>
          [...old, { ...result.row, count: 0 }].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
        setName("");
        setOpen(false);
      } catch {
        setError(
          "Unable to create the category. Your entry was kept. Reconnect and try again.",
        );
      }
    });
  };
  return (
    <div className="items-manager-page categories-page">
      <header className="items-manager-header">
        <Link href="/workspace/account/inventory" aria-label="Back to items">
          ←
        </Link>
        <h1>Items</h1>
        <Link
          href="/workspace/account/inventory/item-settings"
          aria-label="Item settings"
        >
          ⚙
        </Link>
      </header>
      <nav className="items-section-tabs" aria-label="Items sections">
        <Link href="/workspace/account/inventory?type=PRODUCT">Products</Link>
        <Link href="/workspace/account/inventory?type=SERVICE">Services</Link>
        <Link
          href="/workspace/account/inventory/categories"
          aria-current="page"
        >
          Categories
        </Link>
        <Link href="/workspace/account/inventory/units">Units</Link>
      </nav>
      <div className="manager-search">
        ⌕
        <input
          aria-label="Search categories"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Category"
        />
      </div>
      <div className="manager-table">
        <div className="manager-table-head">
          <span>Category Name</span>
          <span>Item Count</span>
        </div>
        <div className="manager-row">
          <span>Items Not in Any Category</span>
          <b>{uncategorizedCount}</b>
        </div>
        {visible.map((x) => (
          <div className="manager-row" key={x.id}>
            <span>{x.name}</span>
            <b>{x.count}</b>
          </div>
        ))}
      </div>
      <button
        className="manager-fab"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        ⊕ Add Category
      </button>
      <dialog
        ref={dialog}
        className="category-create-dialog"
        aria-labelledby="category-create-title"
        onCancel={(e) => {
          if (pending) e.preventDefault();
          else setOpen(false);
        }}
        onClose={() => setOpen(false)}
      >
        <header>
          <h2 id="category-create-title">Add Category</h2>
          <button
            type="button"
            aria-label="Close category creation"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          className="manager-sheet-body"
        >
          <label htmlFor="category-name">Category name</label>
          <input
            id="category-name"
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter Category Name"
            disabled={pending}
          />
          {error && <p role="alert">{error}</p>}
          <button disabled={!name.trim() || pending}>
            {pending ? "Creating…" : "Create"}
          </button>
        </form>
      </dialog>
    </div>
  );
}
