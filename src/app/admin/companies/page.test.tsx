import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireGlobalSuperAdmin: mocks.auth }));
vi.mock("@/lib/admin/dashboard", () => ({ getAdminCompanies: mocks.list }));
import Page from "./page";
describe("Super Admin Companies page", () => {
  it("authorizes and targets the Company's UUID from server data", async () => { const id = "11111111-1111-4111-8111-111111111111"; mocks.list.mockResolvedValue([{ id, name: "Alpha", productEdition: "SALESPUNCH360", subscriptionStatus: "ACTIVE", trialEndsAt: null, createdAt: new Date("2026-01-01"), _count: { users: 2 } }]); const tree = await Page({ searchParams: Promise.resolve({}) }); expect(mocks.auth).toHaveBeenCalled(); const seen = new WeakSet(); const output = JSON.stringify(tree, (key, value) => { if (key === "type" || key === "_owner") return undefined; if (value && typeof value === "object") { if (seen.has(value)) return undefined; seen.add(value); } return value; }); expect(output).toContain(`/admin/companies/${id}`); expect(output).not.toContain("Permanently Delete Company"); });
});
