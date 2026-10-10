import { beforeEach, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ issue: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: calls.revalidate }));
vi.mock("@/lib/account/action-feedback", () => ({
  accountAction: async (work: () => Promise<void>) => {
    await work();
    return { kind: "success" };
  },
}));
vi.mock("@/lib/account/project-material-service", () => ({
  issueInventoryToProject: calls.issue,
  consumeProjectMaterial: vi.fn(),
  returnProjectMaterial: vi.fn(),
  reverseProjectMaterial: vi.fn(),
  transferProjectMaterial: vi.fn(),
}));
import { issueProjectMaterialAction } from "./project-material";
beforeEach(() => {
  vi.clearAllMocks();
});
it("submits a budgetless web issue without empty optional identities", async () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    projectId: "project",
    productId: "product",
    warehouseId: "warehouse",
    quantity: "2",
    projectBudgetLineId: "",
    batchId: "",
    serialNumberId: "",
    notes: "",
    idempotencyKey: "stable-request",
  }))
    form.set(key, value);
  await issueProjectMaterialAction(form);
  expect(calls.issue).toHaveBeenCalledWith({
    projectId: "project",
    productId: "product",
    warehouseId: "warehouse",
    quantity: "2",
    notes: "",
    idempotencyKey: "stable-request",
  });
  expect(calls.revalidate).toHaveBeenCalledWith(
    "/workspace/account/projects/material",
  );
});
it("preserves a supplied budget and tracked identities for server scope validation", async () => {
  const form = new FormData();
  form.set("projectBudgetLineId", "budget");
  form.set("batchId", "batch");
  await issueProjectMaterialAction(form);
  expect(calls.issue).toHaveBeenCalledWith({
    projectBudgetLineId: "budget",
    batchId: "batch",
  });
});
