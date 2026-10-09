"use client";
import { useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionFeedbackForm } from "./action-feedback-form";
import {
  issueProjectMaterialAction,
  consumeProjectMaterialAction,
  returnProjectMaterialAction,
  transferProjectMaterialAction,
  reverseProjectMaterialAction,
} from "@/app/actions/project-material";
type Action = "ISSUE" | "CONSUME" | "RETURN" | "TRANSFER" | "REVERSE";
type Context = {
  projects: Array<{
    id: string;
    branchId: string;
    name: string;
    projectNumber: string;
  }>;
  warehouses: Array<{ id: string; branchId: string; name: string }>;
  products: Array<{ id: string; name: string }>;
  budgetLines: Array<{ id: string; projectId: string; title: string }>;
  sources: Array<{
    id: string;
    projectId: string;
    productName: string;
    availableQuantity: string;
    originalUnitCost: string;
    isReversed: boolean;
  }>;
  movements: Array<{
    id: string;
    projectId: string;
    movementType: string;
    quantity: string;
    totalCost: string;
    movementDate: string;
    isReversed: boolean;
  }>;
  capabilities: Record<Action, boolean>;
  sourcePage: number;
  sourcePages: number;
  historyPage: number;
  historyPages: number;
};
const actions = {
  ISSUE: issueProjectMaterialAction,
  CONSUME: consumeProjectMaterialAction,
  RETURN: returnProjectMaterialAction,
  TRANSFER: transferProjectMaterialAction,
  REVERSE: reverseProjectMaterialAction,
};
const labels: Record<Action, string> = {
  ISSUE: "Issue inventory",
  CONSUME: "Consume material",
  RETURN: "Return to inventory",
  TRANSFER: "Transfer to Project",
  REVERSE: "Reverse movement",
};
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending}>{pending ? "Posting…" : "Post movement"}</button>
  );
}
export function ProjectMaterialForms({ context: c }: { context: Context }) {
  const router = useRouter();
  const search = useSearchParams();
  const [action, setAction] = useState<Action>(
    () =>
      (Object.keys(labels) as Action[]).find((x) => c.capabilities[x]) ??
      "ISSUE",
  );
  const [project, setProject] = useState(search.get("projectId") ?? c.projects[0]?.id ?? "");
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const current = c.projects.find((x) => x.id === project),
    sources = c.sources.filter(
      (x) =>
        x.projectId === project &&
        !x.isReversed &&
        Number(x.availableQuantity) > 0,
    ),
    selected = sources.find((x) => x.id === source),
    destinations = c.projects.filter(
      (x) => x.id !== project && x.branchId === current?.branchId,
    );
  const change = () => setRequestKey(crypto.randomUUID());
  const link = (key: string, page: number) => {
    const q = new URLSearchParams({
      sourcePage: String(c.sourcePage),
      historyPage: String(c.historyPage),
    });
    if (project) q.set("projectId", project);
    q.set(key, String(page));
    return `/workspace/account/projects/material?${q}`;
  };
  return (
    <div className="stack">
      {Object.values(c.capabilities).some(Boolean) ? (
        <ActionFeedbackForm
          action={actions[action]}
          className="account-card stack"
          onSuccess={() => {
            change();
            setSource("");
            router.refresh();
          }}
        >
          <label>
            Action
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value as Action);
                change();
              }}
            >
              {(Object.keys(labels) as Action[])
                .filter((x) => c.capabilities[x])
                .map((x) => (
                  <option key={x} value={x}>
                    {labels[x]}
                  </option>
                ))}
            </select>
          </label>
          <input type="hidden" name="idempotencyKey" value={requestKey} />
          {action !== "REVERSE" ? (
            <>
              <label>
                {action === "TRANSFER" ? "Source Project" : "Project"}
                <select
                  name={action === "TRANSFER" ? "sourceProjectId" : "projectId"}
                  required
                  value={project}
                  onChange={(e) => {
                    setProject(e.target.value);
                    setSource("");
                    setDestination("");
                    if (e.target.value) router.push(`/workspace/account/projects/material?${new URLSearchParams({projectId: e.target.value, sourcePage: "1", historyPage: "1"})}`);
                    change();
                  }}
                >
                  <option value="">Select Project</option>
                  {c.projects.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.projectNumber} · {x.name}
                    </option>
                  ))}
                </select>
              </label>
              {action === "ISSUE" ? (
                <>
                  <label>
                    Product
                    <select name="productId" required onChange={change}>
                      <option value="">Select product</option>
                      {c.products.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Budget line
                    <select
                      name="projectBudgetLineId"
                      required
                      onChange={change}
                    >
                      <option value="">Select budget line</option>
                      {c.budgetLines
                        .filter((x) => x.projectId === project)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.title}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Original material
                    <select
                      name="sourceMovementId"
                      required
                      value={source}
                      onChange={(e) => {
                        setSource(e.target.value);
                        change();
                      }}
                    >
                      <option value="">Select available receipt</option>
                      {sources.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.productName} · available {x.availableQuantity} · ₹
                          {x.originalUnitCost}/unit
                        </option>
                      ))}
                    </select>
                  </label>
                  {!sources.length && (
                    <p>
                      No available receipts on this page. Use receipt pagination
                      below to find older material.
                    </p>
                  )}
                </>
              )}
              {action === "ISSUE" || action === "RETURN" ? (
                <label>
                  Warehouse
                  <select name="warehouseId" required onChange={change}>
                    <option value="">Select warehouse</option>
                    {c.warehouses
                      .filter((x) => x.branchId === current?.branchId)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
              {action === "TRANSFER" && (
                <label>
                  Destination Project
                  <select
                    name="destinationProjectId"
                    required
                    value={destination}
                    onChange={(e) => {
                      setDestination(e.target.value);
                      change();
                    }}
                  >
                    <option value="">Select destination</option>
                    {destinations.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.projectNumber} · {x.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Quantity
                <input
                  name="quantity"
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  max={
                    action === "ISSUE" ? undefined : selected?.availableQuantity
                  }
                  required
                  onChange={change}
                />
              </label>
            </>
          ) : (
            <label>
              Movement
              <select name="movementId" required onChange={change}>
                <option value="">Select unreversed movement</option>
                {c.movements
                  .filter(
                    (x) =>
                      !x.isReversed &&
                      ![
                        "REVERSAL",
                        "TRANSFER_IN",
                        "DIRECT_PROJECT_RECEIPT",
                      ].includes(x.movementType),
                  )
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.movementType.replaceAll("_", " ")} · {x.quantity} ·{" "}
                      {x.movementDate.slice(0, 10)}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Effective date
            <input
              type="date"
              name="movementDate"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
              onChange={change}
            />
          </label>
          {["RETURN", "TRANSFER", "REVERSE"].includes(action) && (
            <label>
              Reason
              <input
                name="reason"
                required
                maxLength={1000}
                onChange={change}
              />
            </label>
          )}
          {action !== "REVERSE" && (
            <label>
              Notes
              <textarea name="notes" maxLength={5000} onChange={change} />
            </label>
          )}
          <Submit />
        </ActionFeedbackForm>
      ) : (
        <p>You have read-only access to Project material.</p>
      )}
      <nav aria-label="Material receipt pages">
        Receipts {c.sourcePage} of {c.sourcePages}{" "}
        {c.sourcePage > 1 && (
          <Link href={link("sourcePage", c.sourcePage - 1)}>
            Previous receipts
          </Link>
        )}{" "}
        {c.sourcePage < c.sourcePages && (
          <Link href={link("sourcePage", c.sourcePage + 1)}>Next receipts</Link>
        )}
      </nav>
      <section className="account-card">
        <h2>Movement history</h2>
        {c.movements.length ? (
          c.movements.map((x) => (
            <p key={x.id}>
              {x.movementDate.slice(0, 10)} ·{" "}
              {x.movementType.replaceAll("_", " ")} · Qty {x.quantity} · ₹
              {x.totalCost}
              {x.isReversed ? " · Reversed" : ""}
            </p>
          ))
        ) : (
          <p>No movements.</p>
        )}
        <nav aria-label="Material history pages">
          History {c.historyPage} of {c.historyPages}{" "}
          {c.historyPage > 1 && (
            <Link href={link("historyPage", c.historyPage - 1)}>
              Previous history
            </Link>
          )}{" "}
          {c.historyPage < c.historyPages && (
            <Link href={link("historyPage", c.historyPage + 1)}>
              Next history
            </Link>
          )}
        </nav>
      </section>
    </div>
  );
}
