import { randomUUID } from "node:crypto";
import { requirePermission } from "@/lib/auth/authorization";
import { projectMaterialContextForActor } from "@/lib/account/project-material-service";
import {
  consumeProjectMaterialAction,
  issueProjectMaterialAction,
  returnProjectMaterialAction,
  reverseProjectMaterialAction,
  transferProjectMaterialAction,
} from "@/app/actions/project-material";
import type { ProjectActor } from "@/lib/account/projects";
const date = new Date().toISOString().slice(0, 10),
  Hidden = () => (
    <>
      <input type="hidden" name="movementDate" value={date} />
      <input type="hidden" name="idempotencyKey" value={randomUUID()} />
    </>
  );
export default async function Page() {
  const actor = (await requirePermission(
      "ACCOUNT_PROJECT_MATERIAL_VIEW",
    )) as ProjectActor,
    ctx = await projectMaterialContextForActor(actor),
    sources = ctx.movements.filter((x) =>
      [
        "DIRECT_PROJECT_RECEIPT",
        "INVENTORY_ISSUE_TO_PROJECT",
        "TRANSFER_IN",
      ].includes(x.movementType),
    );
  return (
    <main>
      <h1>Project Material</h1>
      <p>
        Immutable material workflows. Available quantity and original cost are
        always recalculated by the server.
      </p>
      <form action={issueProjectMaterialAction} className="account-card stack">
        <h2>Issue inventory to Project</h2>
        <select name="projectId" required>
          {ctx.projects.map((x) => (
            <option value={x.id} key={x.id}>
              {x.projectNumber} · {x.name}
            </option>
          ))}
        </select>
        <select name="warehouseId" required>
          {ctx.warehouses.map((x) => (
            <option value={x.id} key={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <select name="productId" required>
          {ctx.products.map((x) => (
            <option value={x.id} key={x.id}>
              {x.name} {x.code && `· ${x.code}`}
            </option>
          ))}
        </select>
        <select name="projectBudgetLineId" required>
          {ctx.budgetLines.map((x) => (
            <option value={x.id} key={x.id}>
              {x.category} · {x.title}
            </option>
          ))}
        </select>
        <input
          name="quantity"
          type="number"
          min="0.000001"
          step="0.000001"
          required
        />
        <textarea name="notes" placeholder="Notes" />
        <Hidden />
        <button
          disabled={
            !ctx.projects.length ||
            !ctx.warehouses.length ||
            !ctx.products.length ||
            !ctx.budgetLines.length
          }
        >
          Issue material
        </button>
      </form>
      {sources.length > 0 && (
        <>
          <MaterialForm
            title="Consume Material"
            action={consumeProjectMaterialAction}
            sources={sources}
          />
          <MaterialForm
            title="Return Material to Inventory"
            action={returnProjectMaterialAction}
            sources={sources}
            warehouses={ctx.warehouses}
          />
          <MaterialForm
            title="Transfer Material"
            action={transferProjectMaterialAction}
            sources={sources}
            projects={ctx.projects}
          />
        </>
      )}
      <section>
        <h2>Movement history</h2>
        {ctx.movements.length ? (
          ctx.movements.map((x) => (
            <p key={x.id}>
              {x.movementDate.toLocaleDateString("en-IN")} ·{" "}
              {x.movementType.replaceAll("_", " ")} · Qty{" "}
              {x.quantity.toString()} · ₹{x.totalCost.toString()}
              {x.movementType !== "REVERSAL" && (
                <form
                  action={reverseProjectMaterialAction}
                  style={{ display: "inline" }}
                >
                  <input type="hidden" name="movementId" value={x.id} />
                  <input
                    type="hidden"
                    name="reason"
                    value="Authorized correction"
                  />
                  <Hidden />
                  <button>Reverse</button>
                </form>
              )}
            </p>
          ))
        ) : (
          <p>No Project material movements.</p>
        )}
      </section>
    </main>
  );
}
function MaterialForm({
  title,
  action,
  sources,
  warehouses = [],
  projects = [],
}: {
  title: string;
  action: (f: FormData) => Promise<void>;
  sources: Array<{
    id: string;
    projectId: string;
    productId: string;
    quantity: { toString(): string };
  }>;
  warehouses?: Array<{ id: string; name: string }>;
  projects?: Array<{ id: string; name: string; projectNumber: string }>;
}) {
  const transfer = title.startsWith("Transfer"),
    returned = title.startsWith("Return");
  return (
    <form action={action} className="account-card stack">
      <h2>{title}</h2>
      <select name="sourceMovementId" required>
        {sources.map((x) => (
          <option value={x.id} key={x.id}>
            {x.productId} · received {x.quantity.toString()}
          </option>
        ))}
      </select>
      <input
        type="hidden"
        name={transfer ? "sourceProjectId" : "projectId"}
        value={sources[0].projectId}
      />
      {returned && (
        <select name="warehouseId" required>
          {warehouses.map((x) => (
            <option value={x.id} key={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      )}
      {transfer && (
        <select name="destinationProjectId" required>
          {projects
            .filter((x) => x.id !== sources[0].projectId)
            .map((x) => (
              <option value={x.id} key={x.id}>
                {x.projectNumber} · {x.name}
              </option>
            ))}
        </select>
      )}
      <input
        name="quantity"
        type="number"
        min="0.000001"
        step="0.000001"
        required
      />
      {(returned || transfer) && (
        <input name="reason" placeholder="Reason" required />
      )}
      <textarea name="notes" placeholder="Notes" />
      <Hidden />
      <button>{title}</button>
    </form>
  );
}
