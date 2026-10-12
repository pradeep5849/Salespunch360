"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./add-expense-item.module.css";

/** Local billed-line entry only; the enclosing expense owns persistence/posting. */
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
        onClose();
      }}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (trimmed && trimmed.length <= 240) onSave(trimmed);
        }}
      >
        <header className={styles.header}>
          <button type="button" aria-label="Back to expense" onClick={onClose}>
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
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={240}
          />
        </div>
        <footer className={styles.footer}>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="account-primary"
            disabled={!name.trim()}
          >
            Save item
          </button>
        </footer>
      </form>
    </dialog>,
    document.body,
  );
}
