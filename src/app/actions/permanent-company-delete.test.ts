import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ remove: vi.fn(), redirect: vi.fn(), log: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/admin/permanent-company-delete", () => ({ permanentlyDeleteCompany: mocks.remove }));
import { CleanupDatabaseError } from "@/lib/tenant-cleanup-database";
import { permanentlyDeleteCompanyAction } from "./permanent-company-delete";

const ID = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(mocks.log);
  mocks.redirect.mockImplementation((url: string) => { throw new Error(`REDIRECT:${url}`); });
});

describe("permanent deletion failure boundary", () => {
  it("logs allow-listed database diagnostics and redirects with only generic blocked state", async () => {
    mocks.remove.mockRejectedValue(new CleanupDatabaseError("DELETE_BILLING_ORDERS", { prismaCode: "P2010", databaseCode: "23503", constraint: "billing_orders_companyId_fkey", table: "billing_orders" }));
    const form = new FormData(); form.set("companyId", ID); form.set("confirmation", "DELETE alpha");
    await expect(permanentlyDeleteCompanyAction(form)).rejects.toThrow(`REDIRECT:/admin/companies/${ID}?prepare=1&error=blocked`);
    expect(mocks.log).toHaveBeenCalledWith("Permanent Company deletion failed", { companyId: ID, stage: "DELETE_BILLING_ORDERS", prismaCode: "P2010", databaseCode: "23503", constraint: "billing_orders_companyId_fkey", table: "billing_orders" });
    expect(JSON.stringify(mocks.redirect.mock.calls)).not.toMatch(/P2010|23503|constraint|billing_orders/);
  });

  it("does not expose an unclassified error message to logs or the browser", async () => {
    mocks.remove.mockRejectedValue(new Error("password=secret customer@example.test SELECT * FROM sessions"));
    const form = new FormData(); form.set("companyId", ID);
    await expect(permanentlyDeleteCompanyAction(form)).rejects.toThrow("error=blocked");
    expect(mocks.log).toHaveBeenCalledWith("Permanent Company deletion failed", { companyId: ID, stage: "UNKNOWN" });
    expect(JSON.stringify([...mocks.log.mock.calls, ...mocks.redirect.mock.calls])).not.toMatch(/secret|customer@|SELECT|sessions/);
  });
});
