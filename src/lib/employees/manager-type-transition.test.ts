import { describe, expect, it, vi } from "vitest";
import { assertManagerOnlyTransitionSafe } from "./manager-type-transition";
const repositories = ["attendance", "customerVisit", "lead", "followUpTask", "customer", "salesTarget"] as const;
const transaction = (conflict?: typeof repositories[number]) => Object.fromEntries(repositories.map(name => [name, { findFirst: vi.fn().mockResolvedValue(name === conflict ? { id: name } : null) }])) as never;
describe("FIELD_MANAGER to MANAGER_ONLY conflict protection", () => {
  it.each(repositories)("rejects an outstanding %s obligation", async conflict => { await expect(assertManagerOnlyTransitionSafe(transaction(conflict), "company", "manager")).rejects.toThrow("MANAGER_TYPE_CONFLICT"); });
  it("allows the transition only when every field obligation is clear", async () => { await expect(assertManagerOnlyTransitionSafe(transaction(), "company", "manager")).resolves.toBeUndefined(); });
});
