import Link from "next/link";
import {
  addMilestoneAction,
  addProjectDocumentAction,
  addProjectMemberAction,
  addTaskAction,
  completeProjectAction,
  linkBoqAction,
  updateMilestoneAction,
  updateTaskAction,
} from "@/app/actions/projects";
import { BudgetEditor } from "./budget-editor";
import {
  getProject,
  getProjectFormOptions,
  type ProjectHistoryParams,
} from "@/lib/account/projects";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { requireAccountWorkspace } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { enabledModulesForCompany } from "@/lib/account/modules";
import { db } from "@/lib/db";

const date = (value: Date | null) => value?.toISOString().slice(0, 10) ?? "";
const statusLabel = (status: string) =>
  status === "ON_HOLD"
    ? "Hold"
    : ["COMPLETED", "CLOSED", "CANCELLED"].includes(status)
      ? "Completed"
      : "Active";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ProjectHistoryParams>;
}) {
  const { id } = await params,
    query = await searchParams,
    actor = await requireAccountWorkspace(),
    [project, options, modules, company] = await Promise.all([
      getProject(id, query),
      getProjectFormOptions(id),
      enabledModulesForCompany(actor.companyId),
      db.company.findUniqueOrThrow({
        where: { id: actor.companyId },
        select: { productEdition: true },
      }),
    ]),
    canCost =
      modules.includes("PROJECT_COSTING") &&
      canUsePermission(
        actor,
        company.productEdition,
        "ACCOUNT_PROJECT_COST_VIEW",
      );

  const sales = project.commercialDocuments.filter((row) =>
    ["SALES_INVOICE", "CREDIT_NOTE"].includes(row.type),
  );
  const purchases = project.commercialDocuments.filter((row) =>
    [
      "PURCHASE_ORDER",
      "PURCHASE_BILL",
      "DEBIT_NOTE",
      "SUBCONTRACT_PURCHASE",
    ].includes(row.type),
  );
  const expenses = purchases.filter(
    (row) =>
      row.type === "PURCHASE_BILL" &&
      row.purchasePurpose === "PROJECT" &&
      row.purchaseClassification === "GENERAL_EXPENSES",
  );
  const mutable = !["COMPLETED", "CLOSED", "CANCELLED"].includes(
    project.status,
  );

  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title={`${project.projectNumber} · ${project.name}`}
          backHref="/workspace/account/projects"
        />
        {mutable && (
          <p>
            <Link href={`/workspace/account/projects/${id}/edit`}>
              Edit project
            </Link>
          </p>
        )}
        {canCost && (
          <p>
            <Link href={`/workspace/account/projects/${id}/costing`}>
              Project Costing / Profitability
            </Link>
          </p>
        )}
        {!mutable && (
          <p>
            <b>Completed project · report only</b>
          </p>
        )}

        <div className="metric-grid">
          <article>
            <b>Project value</b>
            <p>{project.projectValue.toString()}</p>
          </article>
          <article>
            <b>Budget</b>
            <p>{project.budgetTotal.toString()}</p>
          </article>
          <article>
            <b>Status</b>
            <p>{statusLabel(project.status)}</p>
          </article>
          <article>
            <b>Open tasks</b>
            <p>{project.openTasks}</p>
          </article>
        </div>

        <h2>Customer & site</h2>
        <p>
          {project.customer.name} · {project.siteName ?? "No site name"}
        </p>
        <p>{project.siteAddress || "No site address"}</p>
        <p>{project.siteContactPhone || project.customer.phone || "No mobile number"}</p>

        <h2>Team / project manager</h2>
        <p>{project.projectManager?.name ?? "Unassigned"}</p>
        <ul>
          {project.members.map((member) => (
            <li key={member.id}>
              {member.user.name} — {member.role}
            </li>
          ))}
        </ul>
        {mutable && (
          <form action={addProjectMemberAction}>
            <input type="hidden" name="projectId" value={id} />
            <label>
              Team member
              <select name="userId" required>
                <option value="">Select user</option>
                {options.memberCandidates.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.accountRole}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="role" value="MEMBER" />
            <button>Add team member</button>
          </form>
        )}

        <h2>BOQ history</h2>
        <ul>
          {project.quotationDocuments.map((boq) => (
            <li key={boq.id}>
              {boq.documentNumber} — {boq.status}
            </li>
          ))}
        </ul>
        <HistoryPages
          id={id}
          keyName="boqsPage"
          page={project.history.boqsPage}
          totalPages={project.history.pages.boqs}
        />
        {mutable && (
          <form action={linkBoqAction}>
            <input type="hidden" name="projectId" value={id} />
            <label>
              Compatible BOQ
              <select name="boqId" required>
                <option value="">Select BOQ</option>
                {options.boqCandidates.map((boq) => (
                  <option key={boq.id} value={boq.id}>
                    {boq.documentNumber} · {boq.status}
                  </option>
                ))}
              </select>
            </label>
            <button>Link BOQ</button>
          </form>
        )}

        <h2>Budget</h2>
        {mutable ? (
          <BudgetEditor
            projectId={id}
            initial={project.budgetLines.map((line) => ({
              category: line.category,
              title: line.title,
              description: line.description ?? "",
              amount: line.amount.toString(),
            }))}
          />
        ) : (
          <ul>
            {project.budgetLines.map((line) => (
              <li key={line.id}>
                {line.category}: {line.title} — {line.amount.toString()}
              </li>
            ))}
          </ul>
        )}

        <h2>Milestones</h2>
        {project.milestones.map((milestone) => (
          <form
            key={milestone.id}
            action={mutable ? updateMilestoneAction : undefined}
            className="stack"
          >
            <input type="hidden" name="projectId" value={id} />
            <input type="hidden" name="milestoneId" value={milestone.id} />
            <input
              name="title"
              defaultValue={milestone.title}
              required
              disabled={!mutable}
            />
            <textarea
              name="description"
              defaultValue={milestone.description ?? ""}
              disabled={!mutable}
            />
            <input
              type="date"
              name="startDate"
              defaultValue={date(milestone.startDate)}
              disabled={!mutable}
            />
            <input
              type="date"
              name="dueDate"
              defaultValue={date(milestone.dueDate)}
              disabled={!mutable}
            />
            <select
              name="status"
              defaultValue={milestone.status}
              disabled={!mutable}
            >
              {["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map(
                (status) => (
                  <option key={status}>{status}</option>
                ),
              )}
            </select>
            {mutable && <button>Update milestone</button>}
          </form>
        ))}
        {mutable && (
          <form action={addMilestoneAction}>
            <input type="hidden" name="projectId" value={id} />
            <input name="title" required />
            <input type="date" name="dueDate" />
            <button>Add milestone</button>
          </form>
        )}

        <h2>Task history</h2>
        {project.tasks.map((task) => (
          <form
            key={task.id}
            action={mutable ? updateTaskAction : undefined}
            className="stack"
          >
            <input type="hidden" name="projectId" value={id} />
            <input type="hidden" name="taskId" value={task.id} />
            <input
              name="title"
              defaultValue={task.title}
              required
              disabled={!mutable}
            />
            <textarea
              name="description"
              defaultValue={task.description ?? ""}
              disabled={!mutable}
            />
            <select
              name="milestoneId"
              defaultValue={task.milestoneId ?? ""}
              disabled={!mutable}
            >
              <option value="">No milestone</option>
              {project.milestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.title}
                </option>
              ))}
            </select>
            <select
              name="assigneeUserId"
              defaultValue={task.assigneeUserId ?? ""}
              disabled={!mutable}
            >
              <option value="">Unassigned</option>
              {project.members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="dueDate"
              defaultValue={date(task.dueDate)}
              disabled={!mutable}
            />
            <select
              name="priority"
              defaultValue={task.priority}
              disabled={!mutable}
            >
              {[0, 1, 2, 3].map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={task.status}
              disabled={!mutable}
            >
              {["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map(
                (status) => (
                  <option key={status}>{status}</option>
                ),
              )}
            </select>
            {mutable && <button>Update task</button>}
          </form>
        ))}
        {mutable && (
          <form action={addTaskAction}>
            <input type="hidden" name="projectId" value={id} />
            <input name="title" required />
            <select name="assigneeUserId">
              <option value="">Unassigned</option>
              {project.members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
            </select>
            <button>Add task</button>
          </form>
        )}
        <HistoryPages
          id={id}
          keyName="tasksPage"
          page={project.history.tasksPage}
          totalPages={project.history.pages.tasks}
        />

        <h2>Documents</h2>
        <ul>
          {project.documents.map((document) => (
            <li key={document.id}>
              <a href={`/api/project-documents/${document.id}`}>
                {document.displayName}
              </a>
            </li>
          ))}
        </ul>
        <HistoryPages
          id={id}
          keyName="documentsPage"
          page={project.history.documentsPage}
          totalPages={project.history.pages.documents}
        />
        {mutable && (
          <form action={addProjectDocumentAction}>
            <input type="hidden" name="projectId" value={id} />
            <input type="file" name="file" required />
            <button>Upload private document</button>
          </form>
        )}

        <h2>Recent project expenses</h2>
        <p>
          {expenses.length} linked general-expense purchase bills on this history
          page.
        </p>
        <h2>Recent purchases & vendor/subcontractor activity</h2>
        <Documents rows={purchases} />
        <h2>Recent invoices</h2>
        <Documents rows={sales} />
        <HistoryPages
          id={id}
          keyName="commercialPage"
          page={project.history.commercialPage}
          totalPages={project.history.pages.commercial}
        />

        <h2>Payments</h2>
        <p>
          Customer payments: {project.customerPayments.toString()} · Vendor
          payments: {project.vendorPayments.toString()}
        </p>
        <p>
          Totals derive automatically from existing settlement allocations and
          advance applications.
        </p>

        <h2>{mutable ? "Complete project" : "Final project report"}</h2>
        {mutable ? (
          <form action={completeProjectAction}>
            <input type="hidden" name="projectId" value={id} />
            <p>
              Completing this project will make it report-only. It cannot be
              reopened.
            </p>
            <button>Complete project</button>
          </form>
        ) : (
          <>
            <p>
              Completed: {project.actualEndDate?.toLocaleDateString() ?? project.closedAt?.toLocaleDateString() ?? "—"}
            </p>
            <p>
              Project value, budget, work history, expenses, purchases, invoices,
              payments and audit history above form the final project report.
            </p>
          </>
        )}

        <h2>Audit history</h2>
        <ul>
          {project.audits.map((event) => (
            <li key={event.id}>
              {event.createdAt.toLocaleString()} — {event.eventType}
            </li>
          ))}
        </ul>
        <HistoryPages
          id={id}
          keyName="auditsPage"
          page={project.history.auditsPage}
          totalPages={project.history.pages.audits}
        />
      </section>
    </main>
  );
}

function HistoryPages({
  id,
  keyName,
  page,
  totalPages,
}: {
  id: string;
  keyName: keyof ProjectHistoryParams;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={`${keyName} pagination`}>
      <span>
        Page {page} of {totalPages}
      </span>
      {page > 1 && (
        <Link
          href={`/workspace/account/projects/${id}?${keyName}=${page - 1}`}
        >
          Previous
        </Link>
      )}
      {page < totalPages && (
        <Link
          href={`/workspace/account/projects/${id}?${keyName}=${page + 1}`}
        >
          Next
        </Link>
      )}
    </nav>
  );
}

function Documents({
  rows,
}: {
  rows: Array<{
    id: string;
    documentNumber: string;
    type: string;
    status: string;
    grandTotal: { toString(): string };
    balanceDue: { toString(): string };
  }>;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Number</th>
            <th>Status</th>
            <th>Total</th>
            <th>Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.type}</td>
              <td>{row.documentNumber}</td>
              <td>{row.status}</td>
              <td>{row.grandTotal.toString()}</td>
              <td>{row.balanceDue.toString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
