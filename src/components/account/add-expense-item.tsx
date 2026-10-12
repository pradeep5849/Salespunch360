"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createExpenseItemAction,
  searchExpenseItemsAction,
} from "@/app/actions/expense-items";
import styles from "./add-expense-item.module.css";

/** Catalogue creation is separate from the enclosing expense payment. */
export function AddExpenseItem({
  onSave,
  onClose,
}: {
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [requestKey] = useState(() => crypto.randomUUID());
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      searchExpenseItemsAction(name.trim().slice(0, 160))
        .then((result) => {
          if (current) setMatches(result.rows);
        })
        .catch(() => {
          if (current)
            setError("Expense items could not be loaded. Try again.");
        });
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [name]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    input.current?.focus();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="add-expense-item-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed || trimmed.length > 240 || saving) return;
          setSaving(true);
          setError(null);
          try {
            const form = new FormData();
            form.set("name", trimmed);
            form.set("requestKey", requestKey);
            if (photo) form.set("photo", photo);
            const result = await createExpenseItemAction(form);
            if (result.item) onSave(result.item.name);
            else setError(result.error ?? "Expense item could not be saved.");
          } catch {
            setError("Expense item could not be saved. Try again.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <header className={styles.header}>
          <button
            type="button"
            aria-label="Back to expense"
            disabled={saving}
            onClick={onClose}
          >
            ←
          </button>
          <h2 id="add-expense-item-title">Add Expense Item</h2>
        </header>
        <div className={styles.body}>
          <label htmlFor="expense-item-name">Item name *</label>
          <input
            ref={input}
            id="expense-item-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setMatches([]);
              setError(null);
            }}
            required
            maxLength={240}
            disabled={saving}
          />
          <label htmlFor="expense-item-photo">Item photo (optional)</label>
          <input
            id="expense-item-photo"
            type="file"
            accept="image/*"
            disabled={saving}
            onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
          />
          {error && <p role="alert">{error}</p>}
          {matches.length > 0 && (
            <section aria-label="Saved expense items">
              <h3>Saved expense items</h3>
              {matches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={saving}
                  onClick={() => onSave(item.name)}
                >
                  {item.name}
                </button>
              ))}
            </section>
          )}
        </div>
        <footer className={styles.footer}>
          <button type="button" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="account-primary"
            disabled={saving || !name.trim()}
          >
            {saving ? "Saving…" : "Save item"}
          </button>
        </footer>
      </form>
    </dialog>,
    document.body,
  );
}
