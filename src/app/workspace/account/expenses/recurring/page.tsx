import Link from "next/link";
import { randomUUID } from "node:crypto";
import { recurringAction } from "@/app/actions/expenses";
import {
  expenseOptions,
  recurringTemplates,
  listExpenses,
} from "@/lib/account/expenses";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { RecurringExpenseForm } from "@/components/account/recurring-expense-form";
import { ActionFeedbackForm } from "@/components/account/action-feedback-form";
import {
  SavePendingFields,
  SaveSubmitButton,
} from "@/components/account/save-feedback";
import { indiaDateText, classifyDueDate } from "@/lib/follow-up-tasks/date";
export default async function Page() {
  const [o, templates, expenses] = await Promise.all([
    expenseOptions(),
    recurringTemplates(),
    listExpenses(),
  ]);
  const today = indiaDateText();
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title="Recurring Expenses"
          backHref="/workspace/account/expenses"
        />
        <p>
          Generate each due occurrence once. Open the unpaid bill to record its
          actual payment date and account. Approval reviews the recorded payment
          without posting it again.
        </p>
        {o.canCreateExpense && (
          <details>
            <summary>Create recurring schedule</summary>
            <RecurringExpenseForm
              requestKey={randomUUID()}
              branches={o.branches}
              categories={o.categories.filter((row) => row.scope !== "INCOME")}
              projects={o.projects}
              action={recurringAction}
            />
          </details>
        )}
        <h2>Schedules</h2>
        {!templates.length && <p>No recurring schedules yet.</p>}
        {templates.map((template) => (
          <section
            className="account-card"
            key={template.id}
            aria-label={`Schedule ${template.id}`}
          >
            <h3>
              {o.categories.find((row) => row.id === template.categoryId)
                ?.name ?? "Expense schedule"}
            </h3>
            <p>
              {template.frequency.toLowerCase()} · {template.amount.toFixed(2)}{" "}
              · Next due {template.nextDueDate.toISOString().slice(0, 10)} ·{" "}
              {template.isActive ? "Active" : "Paused"}
              {template.isActive &&
                ` · ${classifyDueDate(template.nextDueDate).toLowerCase()}`}
            </p>
            {o.canCreateExpense && (
              <>
                <details>
                  <summary>Edit future schedule</summary>
                  <ActionFeedbackForm action={recurringAction}>
                    <input type="hidden" name="operation" value="edit" />
                    <input type="hidden" name="id" value={template.id} />
                    <input
                      type="hidden"
                      name="expectedUpdatedAt"
                      value={template.updatedAt.toISOString()}
                    />
                    <label>
                      Frequency
                      <select
                        name="frequency"
                        defaultValue={template.frequency}
                        required
                      >
                        {["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"].map(
                          (frequency) => (
                            <option key={frequency} value={frequency}>
                              {frequency.toLowerCase()}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      Next due date
                      <input
                        name="nextDueDate"
                        type="date"
                        defaultValue={template.nextDueDate
                          .toISOString()
                          .slice(0, 10)}
                        required
                      />
                    </label>
                    <label>
                      Future bill amount
                      <input
                        name="amount"
                        type="text"
                        inputMode="decimal"
                        defaultValue={template.amount.toFixed(2)}
                        required
                      />
                    </label>
                    <p>Existing bills and recorded payments stay unchanged.</p>
                    <SaveSubmitButton>Save schedule changes</SaveSubmitButton>
                  </ActionFeedbackForm>
                </details>
                <ActionFeedbackForm action={recurringAction}>
                  <input type="hidden" name="operation" value="active" />
                  <input type="hidden" name="id" value={template.id} />
                  <input
                    type="hidden"
                    name="isActive"
                    value={String(!template.isActive)}
                  />
                  <SaveSubmitButton>
                    {template.isActive ? "Pause schedule" : "Resume schedule"}
                  </SaveSubmitButton>
                </ActionFeedbackForm>
                {template.isActive && (
                  <ActionFeedbackForm action={recurringAction}>
                    <SavePendingFields>
                      <input type="hidden" name="operation" value="generate" />
                      <input
                        type="hidden"
                        name="templateId"
                        value={template.id}
                      />
                      <input
                        type="hidden"
                        name="expectedDueDate"
                        value={template.nextDueDate.toISOString().slice(0, 10)}
                      />
                      <label>
                        Payment account
                        <select required name="moneyAccountId">
                          <option value="">Select account</option>
                          {o.moneyAccounts
                            .filter(
                              (row) =>
                                !row.branchId ||
                                row.branchId === template.branchId,
                            )
                            .map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    </SavePendingFields>
                    <fieldset
                      disabled={
                        template.nextDueDate.toISOString().slice(0, 10) > today
                      }
                    >
                      <SaveSubmitButton>Generate due bill</SaveSubmitButton>
                    </fieldset>
                  </ActionFeedbackForm>
                )}
              </>
            )}
            <Link
              href={`/workspace/account/expenses?templateId=${template.id}&branchId=${template.branchId}`}
            >
              View all bills for this schedule
            </Link>
            <h4>Recent bills</h4>
            <ul>
              {expenses
                .filter((row) =>
                  row.occurrenceKey?.startsWith(template.id + ":"),
                )
                .map((row) => (
                  <li key={row.id}>
                    <Link href={`/workspace/account/expenses/${row.id}`}>
                      {row.transactionNumber} ·{" "}
                      {row.status.replaceAll("_", " ")}
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </section>
    </div>
  );
}
