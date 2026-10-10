import { randomUUID } from "node:crypto";
import {
  ExpenseEditor,
  type ExpenseValue,
  type ExpenseEditorOptions,
} from "./expense-editor";
import type { expenseOptions } from "@/lib/account/expenses";
import type { AccountActionResult } from "@/lib/account/action-feedback";
export function ExpenseForm({
  options,
  expense,
  action,
  formKey = "new",
}: {
  options: Awaited<ReturnType<typeof expenseOptions>>;
  expense?: unknown;
  action: (fd: FormData) => Promise<AccountActionResult>;
  formKey?: string;
}) {
  return (
    <ExpenseEditor
      key={formKey}
      options={
        JSON.parse(
          JSON.stringify(options, (_key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          ),
        ) as ExpenseEditorOptions
      }
      expense={
        expense
          ? (JSON.parse(JSON.stringify(expense)) as ExpenseValue)
          : undefined
      }
      action={action}
      requestKey={randomUUID()}
    />
  );
}
