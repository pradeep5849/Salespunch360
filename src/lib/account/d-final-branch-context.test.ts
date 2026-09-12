import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ saved: undefined as string | undefined, branches: [] as Array<{ id: string; name: string; isPrimary: boolean }> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.saved ? { value: state.saved } : undefined, set: vi.fn() }) }));
vi.mock("@/lib/db", () => ({ db: { branch: { findMany: vi.fn(async () => state.branches) } } }));

import { AuthorizationError } from "@/lib/auth/authorization";
import { resolveAccountBranchContext } from "./branch-context";

const actor = { id: "user", companyId: "company", accountRole: "ACCOUNT_ADMIN" as const, branchAccessScope: "ALL_BRANCHES" as const, branchIds: [] };
const branch = (id: string, name: string, isPrimary = false) => ({ id, name, isPrimary });

beforeEach(() => { state.saved = undefined; state.branches = []; });

describe("D final Account branch defaults", () => {
  it("uses the sole authorized branch and disables consolidation", async () => {
    state.branches = [branch("head", "Head Office", true)];
    await expect(resolveAccountBranchContext(actor)).resolves.toMatchObject({ context: { mode: "BRANCH", branchId: "head" }, canConsolidate: false });
  });
  it("initially prefers the primary branch when several are authorized", async () => {
    state.branches = [branch("head", "Head Office", true), branch("other", "Mysore Branch")];
    await expect(resolveAccountBranchContext(actor)).resolves.toMatchObject({ context: { mode: "BRANCH", branchId: "head" }, canConsolidate: true });
  });
  it("retains an explicit All Branches selection only while multiple branches and permission remain", async () => {
    state.saved = "all"; state.branches = [branch("head", "Head Office", true), branch("other", "Mysore Branch")];
    await expect(resolveAccountBranchContext(actor)).resolves.toMatchObject({ context: { mode: "COMPANY" } });
    state.branches = [branch("head", "Head Office", true)];
    await expect(resolveAccountBranchContext(actor)).resolves.toMatchObject({ context: { mode: "BRANCH", branchId: "head" } });
  });
  it("rejects unauthorized consolidation and branch IDs", async () => {
    state.branches = [branch("head", "Head Office", true), branch("other", "Mysore Branch")];
    await expect(resolveAccountBranchContext({ ...actor, accountRole: "ACCOUNTANT" }, { scope: "all" })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(resolveAccountBranchContext(actor, { branchId: "foreign" })).rejects.toBeInstanceOf(AuthorizationError);
  });
});
