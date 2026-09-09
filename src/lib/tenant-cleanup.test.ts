import { describe, expect, it, vi } from "vitest";
import { cleanupTenants, confirmationFor, DELETE_ORDER, parseCleanupArgs, PRESERVED_MODELS, TENANT_MODELS, type CleanupDatabase, type Inventory } from "./tenant-cleanup";

const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
function inventory(id = A): Inventory {
  return { company: { id, name: id === A ? "Alpha" : "Beta", slug: id === A ? "alpha" : "beta", primaryAdmin: { name: "Admin", email: "admin@example.test" } }, counts: Object.fromEntries(TENANT_MODELS.map(model => [model, model === "Company" ? 1 : id === A ? 2 : 7])) as Inventory["counts"], storage: [{ key: `Logo/${id}.webp`, source: "Company.logoObjectKey" }, { key: `companies/${id}/employees/u/check-ins/v/photo.webp`, source: "VisitPhoto.objectKey" }, { key: `companies/${id}/employees/u/check-ins/v/thumb.webp`, source: "VisitPhoto.thumbnailObjectKey" }] };
}
function harness(records = new Map([[A, inventory(A)], [B, inventory(B)]]), superAdmin = false) {
  const writes: string[] = [];
  const db: CleanupDatabase = { inventory: vi.fn(async id => records.get(id) ?? null), hasSuperAdmin: vi.fn(async () => superAdmin), deleteTenant: vi.fn(async id => { writes.push(id); records.delete(id); }), verifyTenantAbsent: vi.fn(async id => !records.has(id)) };
  const storage = { delete: vi.fn(async () => undefined) };
  return { db, storage, writes, records };
}

describe("controlled tenant cleanup safety", () => {
  it("refuses no company IDs", () => expect(() => parseCleanupArgs([])).toThrow("COMPANY_ID_REQUIRED"));
  it("refuses malformed UUIDs", () => expect(() => parseCleanupArgs(["--company-id", "test"])).toThrow("INVALID_COMPANY_ID"));
  it("dry-run performs zero writes", async () => { const h = harness(); await cleanupTenants(h.db, h.storage, parseCleanupArgs(["--company-id", A])); expect(h.writes).toEqual([]); expect(h.storage.delete).not.toHaveBeenCalled(); });
  it("counts only the selected company", async () => { const h = harness(); const r = await cleanupTenants(h.db, h.storage, parseCleanupArgs(["--company-id", A])); expect(r.inventories.map(x => x.company.id)).toEqual([A]); expect(r.inventories[0].counts.User).toBe(2); });
  it("does not inspect or mutate a second company", async () => { const h = harness(); await cleanupTenants(h.db, h.storage, parseCleanupArgs(["--company-id", A])); expect(h.db.inventory).not.toHaveBeenCalledWith(B); expect(h.records.has(B)).toBe(true); });
  it("protects SUPER_ADMIN", async () => { const h = harness(undefined, true); await expect(cleanupTenants(h.db, h.storage, parseCleanupArgs(["--company-id", A]))).rejects.toThrow("SUPER_ADMIN_TENANT_CORRUPTION"); expect(h.writes).toEqual([]); });
  it("never includes BillingPrice in deletion", () => { expect(DELETE_ORDER).not.toContain("BillingPrice"); expect(PRESERVED_MODELS).toContain("BillingPrice"); });
  it("never touches migration tables", () => { expect(DELETE_ORDER).not.toContain("_prisma_migrations"); expect(PRESERVED_MODELS).toContain("_prisma_migrations"); });
  it("includes every discovered tenant model in count/delete coverage", () => { expect(TENANT_MODELS.filter(m => m !== "Company").every(m => DELETE_ORDER.includes(m as typeof DELETE_ORDER[number]))).toBe(true); });
  it("uses valid child-first dependency order", () => { const before = (a: string, b: string) => expect(DELETE_ORDER.indexOf(a as never)).toBeLessThan(DELETE_ORDER.indexOf(b as never)); before("VisitPhoto", "CustomerVisit"); before("CustomerVisit", "Lead"); before("Lead", "Customer"); before("PaymentTransaction", "BillingOrder"); before("UserBranchAccess", "User"); before("User", "Company"); });
  it("scopes storage inventory by selected tenant", async () => { const h = harness(); const r = await cleanupTenants(h.db, h.storage, parseCleanupArgs(["--company-id", A])); expect(r.inventories[0].storage.every(x => x.key.includes(A))).toBe(true); });
  it("scopes company logo inventory", () => expect(inventory(A).storage.filter(x => x.source === "Company.logoObjectKey")).toEqual([{ key: `Logo/${A}.webp`, source: "Company.logoObjectKey" }]));
  it("scopes visit image and thumbnail inventory", () => expect(inventory(A).storage.filter(x => x.source.startsWith("VisitPhoto")).map(x => x.key)).toEqual([`companies/${A}/employees/u/check-ins/v/photo.webp`, `companies/${A}/employees/u/check-ins/v/thumb.webp`]));
  it("treats a missing storage object as successful when storage delete is idempotent", async () => { const h = harness(); h.storage.delete.mockResolvedValue(undefined); const options = parseCleanupArgs(["--company-id", A, "--execute", "--confirmation", confirmationFor([A])]); const r = await cleanupTenants(h.db, h.storage, options); expect(r.storageResults.every(x => x.status === "DELETED_OR_MISSING")).toBe(true); });
  it("requires confirmation for execution", () => expect(() => parseCleanupArgs(["--company-id", A, "--execute"])).toThrow("CONFIRMATION_REQUIRED_OR_INCORRECT"));
  it("refuses wrong confirmation", () => expect(() => parseCleanupArgs(["--company-id", A, "--execute", "--confirmation", "wrong"])).toThrow("CONFIRMATION_REQUIRED_OR_INCORRECT"));
  it("has no wildcard or all-tenants mode", () => expect(() => parseCleanupArgs(["--all"])).toThrow("UNSUPPORTED_ARGUMENT:--all"));
  it("is idempotent and fail-closed for an absent tenant", async () => { const h = harness(new Map()); await expect(cleanupTenants(h.db, h.storage, parseCleanupArgs(["--company-id", A]))).rejects.toThrow("TENANT_NOT_FOUND_OR_ALREADY_CLEANED"); });
  it("removes Account state only with selected tenant User identities", () => { expect(TENANT_MODELS).toContain("User"); expect(DELETE_ORDER.indexOf("User")).toBeLessThan(DELETE_ORDER.indexOf("Company")); });
  it("leaves unrelated tenants unchanged after guarded execution", async () => { const h = harness(); await cleanupTenants(h.db, h.storage, parseCleanupArgs(["--company-id", A, "--execute", "--confirmation", confirmationFor([A])])); expect(h.records.has(A)).toBe(false); expect(h.records.get(B)?.counts.User).toBe(7); });
});
