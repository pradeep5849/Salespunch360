"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  createCategoryWithFeedbackAction,
  editCategoryWithFeedbackAction,
} from "@/app/actions/account-masters";

export function CategoriesManager({
  categories: initial,
  uncategorizedCount,
}: {
  categories: {
    id: string;
    name: string;
    count: number;
    description?: string | null;
    scope?: string;
    updatedAt?: string;
  }[];
  uncategorizedCount: number;
}) {
  const [rows, setRows] = useState(initial),
    [q, setQ] = useState(""),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [editing, setEditing] = useState<(typeof initial)[number] | null>(null),
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
        const result = editing
          ? await editCategoryWithFeedbackAction({
              id: editing.id,
              expectedUpdatedAt: editing.updatedAt,
              name: name.trim(),
              description,
            })
          : await createCategoryWithFeedbackAction({
              name: name.trim(),
              scope: "BOTH",
            });
        if (result.kind === "error") {
          setError(result.message);
          return;
        }
        setRows((old) =>
          (editing
            ? old.map((row) =>
                row.id === editing.id ? { ...row, ...result.row } : row,
              )
            : [...old, { ...result.row, count: 0 }]
          ).sort((a, b) => a.name.localeCompare(b.name)),
        );
        setName("");
        setOpen(false);
      } catch {
        setError(
          "Unable to save the category. Your entry was kept. Reconnect and try again.",
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
        <Link href="/workspace/account/inventory/catalog?type=PRODUCT">
          Products
        </Link>
        <Link href="/workspace/account/inventory/catalog?type=SERVICE">
          Services
        </Link>
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
            <span>
              {x.name}
              <small style={{ display: "block" }}>
                {x.scope ?? "BOTH"}
                {x.description ? ` · ${x.description}` : ""}
              </small>
              {x.updatedAt && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setEditing(x);
                    setName(x.name);
                    setDescription(x.description ?? "");
                    setError(null);
                    setOpen(true);
                  }}
                >
                  Edit
                </button>
              )}
            </span>
            <b>{x.count}</b>
          </div>
        ))}
      </div>
      <button
        className="manager-fab"
        onClick={() => {
          setError(null);
          setEditing(null);
          setName("");
          setDescription("");
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
          <h2 id="category-create-title">
            {editing ? "Edit Category" : "Add Category"}
          </h2>
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
          method="post"
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
          {editing && (
            <>
              <p>Scope: {editing.scope ?? "BOTH"} (unchanged)</p>
              <label htmlFor="category-description">Description</label>
              <textarea
                id="category-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                disabled={pending}
              />
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <button disabled={!name.trim() || pending}>
            {pending ? "Saving…" : editing ? "Save" : "Create"}
          </button>
        </form>
      </dialog>
    </div>
  );
}
