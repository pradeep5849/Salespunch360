import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { cleanupTenants, confirmationFor, DELETE_ORDER, parseCleanupArgs, PRESERVED_MODELS, TENANT_MODELS, USER_OWNED_RESIDUE_MODELS, validateStorageOwnership, type CleanupDatabase, type Inventory, type LockedCleanupDatabase, type StorageObject } from "./tenant-cleanup";

const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333", VISIT = "44444444-4444-4444-8444-444444444444";
const logo = (companyId = A): StorageObject => ({ key: `Logo/${companyId}.webp`, source: "Company.logoObjectKey" });
const main = (key = `companies/${A}/employees/${USER}/check-ins/${VISIT}/photo.webp`): StorageObject => ({ key, source: "VisitPhoto.objectKey", visitId: VISIT, uploadedByUserId: USER });
const thumb = (key = `companies/${A}/employees/${USER}/check-ins/${VISIT}/thumb.webp`): StorageObject => ({ key, source: "VisitPhoto.thumbnailObjectKey", visitId: VISIT, uploadedByUserId: USER });
const pending = (key = `companies/${A}/employees/${USER}/check-ins/${VISIT}/photo.webp`): StorageObject => ({ key, source: "PendingStorageDeletion.objectKey" });

function inventory(id = A, storage: StorageObject[] = [logo(id), ...(id === A ? [main(), thumb()] : [])]): Inventory {
  return { company: { id, name: id === A ? "Alpha" : "Beta", slug: id === A ? "alpha" : "beta", primaryAdmin: { name: "Admin", email: "admin@example.test" } }, counts: Object.fromEntries(TENANT_MODELS.map(model => [model, model === "Company" ? 1 : id === A ? 2 : 7])) as Inventory["counts"], storage };
}

function harness({ records = new Map([[A, inventory(A)], [B, inventory(B)]]), lockedInventory, superAdmin = false, lockedSuperAdmin = superAdmin, livenessFailsAt }:
  { records?: Map<string, Inventory>; lockedInventory?: Inventory | null; superAdmin?: boolean; lockedSuperAdmin?: boolean; livenessFailsAt?: number } = {}) {
  const events: string[] = [], storage = { delete: vi.fn(async (key: string) => { events.push(`storage:${key}`); }) };
  let livenessCalls = 0;
  const locked: LockedCleanupDatabase = {
    inventory: vi.fn(async id => { events.push("authoritative_inventory"); return lockedInventory === undefined ? records.get(id) ?? null : lockedInventory; }),
    hasSuperAdmin: vi.fn(async () => { events.push("locked_super_admin"); return lockedSuperAdmin; }),
    assertTransactionAlive: vi.fn(async () => { events.push("liveness"); livenessCalls++; if (livenessCalls === livenessFailsAt) throw new Error("TRANSACTION_EXPIRED"); }),
    deleteTenant: vi.fn(async id => { events.push("db_delete"); records.delete(id); }),
    verifyTenantAbsent: vi.fn(async id => { events.push("residue_check"); return !records.has(id); }),
  };
  const db: CleanupDatabase = {
    inventory: vi.fn(async id => records.get(id) ?? null),
    hasSuperAdmin: vi.fn(async () => superAdmin),
    withLockedTenant: vi.fn(async (_id, work) => { events.push("serializable_begin"); events.push("company_for_update"); return work(locked); }),
  };
  return { db, locked, storage, records, events };
}

const execute = () => parseCleanupArgs(["--company-id", A, "--execute", "--confirmation", confirmationFor([A])]);
const expectUnsafe = (object: StorageObject) => expect(() => validateStorageOwnership(inventory(A, [object]))).toThrow("UNSAFE_STORAGE_KEY");

describe("strict storage ownership", () => {
  it("accepts the exact Company logo key", () => expect(() => validateStorageOwnership(inventory(A, [logo()]))).not.toThrow());
  it("rejects another company's logo", () => expectUnsafe(logo(B)));
  it("rejects a malformed logo key", () => expectUnsafe({ ...logo(), key: `Logo/${A}.png` }));
  it("accepts the exact VisitPhoto main key", () => expect(() => validateStorageOwnership(inventory(A, [main()]))).not.toThrow());
  it("accepts the exact VisitPhoto thumbnail key", () => expect(() => validateStorageOwnership(inventory(A, [thumb()]))).not.toThrow());
  it("rejects a VisitPhoto key for another company", () => expectUnsafe(main(`companies/${B}/employees/${USER}/check-ins/${VISIT}/photo.webp`)));
  it("rejects a VisitPhoto key with the wrong uploader", () => expectUnsafe(main(`companies/${A}/employees/${B}/check-ins/${VISIT}/photo.webp`)));
  it("rejects a VisitPhoto key with the wrong visit", () => expectUnsafe(main(`companies/${A}/employees/${USER}/check-ins/${B}/photo.webp`)));
  it("rejects traversal-like VisitPhoto keys", () => expectUnsafe(main(`companies/${A}/employees/${USER}/check-ins/${VISIT}/../photo.webp`)));
  it("accepts the selected-company pending namespace", () => expect(() => validateStorageOwnership(inventory(A, [pending()]))).not.toThrow());
  it("rejects another company's pending key", () => expectUnsafe(pending(`companies/${B}/employees/${USER}/check-ins/${VISIT}/photo.webp`)));
  it("rejects unknown and traversal pending namespaces", () => { expectUnsafe(pending(`Logo/${A}.webp`)); expectUnsafe(pending(`companies/${A}/../${B}/photo.webp`)); expectUnsafe(pending(`companies\\${A}\\photo.webp`)); expectUnsafe(pending("")); });
  it("fails unsafe dry-run inventory with zero mutation", async () => { const h = harness({ records: new Map([[A, inventory(A, [logo(B)])]]) }); await expect(cleanupTenants(h.db, h.storage, parseCleanupArgs(["--company-id", A]))).rejects.toThrow("UNSAFE_STORAGE_KEY"); expect(h.storage.delete).not.toHaveBeenCalled(); expect(h.db.withLockedTenant).not.toHaveBeenCalled(); });
});

describe("controlled execution", () => {
  it("uses a singular confirmation for exactly one tenant", () => expect(confirmationFor([A])).toBe(`DELETE_TEST_TENANT_${A}`));
  it("rejects multi-tenant execute", () => expect(() => parseCleanupArgs(["--company-id", A, "--company-id", B, "--execute", "--confirmation", "anything"])).toThrow("EXECUTE_ONE_TENANT_ONLY"));
  it("retains multi-tenant dry-run", () => expect(parseCleanupArgs(["--company-id", A, "--company-id", B]).execute).toBe(false));
  it("has no wildcard or all-tenants mode", () => { expect(() => parseCleanupArgs(["--all"])).toThrow("UNSUPPORTED_ARGUMENT:--all"); expect(() => parseCleanupArgs(["--company-id", "*"])).toThrow("INVALID_COMPANY_ID"); });
  it("requires exact confirmation", () => expect(() => parseCleanupArgs(["--company-id", A, "--execute", "--confirmation", "wrong"])).toThrow("CONFIRMATION_REQUIRED_OR_INCORRECT"));
  it("locks Company before authoritative inventory", async () => { const h = harness(); await cleanupTenants(h.db, h.storage, execute()); expect(h.events.indexOf("company_for_update")).toBeLessThan(h.events.indexOf("authoritative_inventory")); });
  it("rechecks SUPER_ADMIN after the Company lock", async () => { const h = harness(); await cleanupTenants(h.db, h.storage, execute()); expect(h.events.indexOf("company_for_update")).toBeLessThan(h.events.indexOf("locked_super_admin")); });
  it("aborts without mutation when the locked SUPER_ADMIN recheck finds corruption", async () => { const h = harness({ lockedSuperAdmin: true }); await expect(cleanupTenants(h.db, h.storage, execute())).rejects.toThrow("SUPER_ADMIN_TENANT_CORRUPTION"); expect(h.storage.delete).not.toHaveBeenCalled(); expect(h.locked.deleteTenant).not.toHaveBeenCalled(); });
  it("deletes storage only after locked inventory and validation", async () => { const h = harness(); await cleanupTenants(h.db, h.storage, execute()); expect(h.events.indexOf("authoritative_inventory")).toBeLessThan(h.events.findIndex(e => e.startsWith("storage:"))); });
  it("checks transaction liveness before the first and every storage deletion", async () => { const h = harness(); await cleanupTenants(h.db, h.storage, execute()); const storageIndexes = h.events.map((event, index) => event.startsWith("storage:") ? index : -1).filter(index => index >= 0); expect(h.events.slice(h.events.indexOf("authoritative_inventory") + 1, storageIndexes[0]).filter(event => event === "liveness")).toHaveLength(2); for (const index of storageIndexes) expect(h.events[index - 1]).toBe("liveness"); });
  it("checks transaction liveness after every storage deletion", async () => { const h = harness(); await cleanupTenants(h.db, h.storage, execute()); for (const [index, event] of h.events.entries()) if (event.startsWith("storage:")) expect(h.events[index + 1]).toBe("liveness"); });
  it("checks transaction liveness immediately before DB deletion", async () => { const h = harness(); await cleanupTenants(h.db, h.storage, execute()); expect(h.events[h.events.indexOf("db_delete") - 1]).toBe("liveness"); });
  it("does not start DB cleanup when the final liveness check fails", async () => { const h = harness({ livenessFailsAt: 8 }); await expect(cleanupTenants(h.db, h.storage, execute())).rejects.toThrow("TRANSACTION_EXPIRED"); expect(h.storage.delete).toHaveBeenCalledTimes(3); expect(h.locked.deleteTenant).not.toHaveBeenCalled(); });
  it("does not delete storage when its pre-delete liveness check fails", async () => { const h = harness({ livenessFailsAt: 2 }); await expect(cleanupTenants(h.db, h.storage, execute())).rejects.toThrow("TRANSACTION_EXPIRED"); expect(h.storage.delete).not.toHaveBeenCalled(); expect(h.locked.deleteTenant).not.toHaveBeenCalled(); });
  it("stops before the next object when a post-delete liveness check fails", async () => { const h = harness({ livenessFailsAt: 3 }); await expect(cleanupTenants(h.db, h.storage, execute())).rejects.toThrow("TRANSACTION_EXPIRED"); expect(h.storage.delete).toHaveBeenCalledTimes(1); expect(h.locked.deleteTenant).not.toHaveBeenCalled(); });
  it("does not pass unrelated tenant storage to delete", async () => { const h = harness({ lockedInventory: inventory(A, [pending(`companies/${B}/photo.webp`)]) }); await expect(cleanupTenants(h.db, h.storage, execute())).rejects.toThrow("UNSAFE_STORAGE_KEY"); expect(h.storage.delete).not.toHaveBeenCalled(); });
  it("performs DB cleanup only after successful storage deletion", async () => { const h = harness(); await cleanupTenants(h.db, h.storage, execute()); expect(h.events.findIndex(e => e.startsWith("storage:"))).toBeLessThan(h.events.indexOf("db_delete")); });
  it("storage failure aborts before DB cleanup", async () => { const h = harness(); h.storage.delete.mockRejectedValueOnce(new Error("storage unavailable")); await expect(cleanupTenants(h.db, h.storage, execute())).rejects.toThrow("STORAGE_DELETE_FAILED"); expect(h.locked.deleteTenant).not.toHaveBeenCalled(); expect(h.events).not.toContain("residue_check"); });
  it("treats missing storage as idempotent when delete resolves", async () => { const h = harness(); h.storage.delete.mockResolvedValue(undefined); const result = await cleanupTenants(h.db, h.storage, execute()); expect(result.storageResults.every(row => row.status === "DELETED_OR_MISSING")).toBe(true); });
  it("leaves unrelated tenant DB rows untouched", async () => { const h = harness(); await cleanupTenants(h.db, h.storage, execute()); expect(h.records.has(B)).toBe(true); expect(h.records.get(B)?.counts.User).toBe(7); });
  it("fails closed when authoritative inventory disappears", async () => { const h = harness({ lockedInventory: null }); await expect(cleanupTenants(h.db, h.storage, execute())).rejects.toThrow("TENANT_NOT_FOUND_OR_ALREADY_CLEANED"); expect(h.storage.delete).not.toHaveBeenCalled(); });
  it("repeated already-deleted tenant fails closed", async () => { const h = harness(); await cleanupTenants(h.db, h.storage, execute()); await expect(cleanupTenants(h.db, h.storage, execute())).rejects.toThrow("TENANT_NOT_FOUND_OR_ALREADY_CLEANED"); });
});

describe("database safety contracts", () => {
  const source = readFileSync("src/lib/tenant-cleanup-database.ts", "utf8");
  it("starts a Serializable transaction and uses Company FOR UPDATE", () => { expect(source).toContain("Prisma.TransactionIsolationLevel.Serializable"); expect(source).toMatch(/SELECT \"id\" FROM \"companies\"[^`]+FOR UPDATE/); });
  it("sets cleanup-only interactive transaction lifetime limits", () => { expect(source).toContain("maxWait: 15_000"); expect(source).toContain("timeout: 300_000"); });
  it("implements liveness with SELECT 1 on the locked transaction client", () => { expect(source).toContain('assertTransactionAlive: async () => { await tx.$queryRaw`SELECT 1`; }'); expect(source).not.toContain('db.$queryRaw`SELECT 1`'); });
  it("keeps the advisory lock only after Company FOR UPDATE", () => expect(source.indexOf("FOR UPDATE")).toBeLessThan(source.indexOf("pg_advisory_xact_lock")));
  it("uses the transaction client for authoritative inventory, checks, deletes and verification", () => { expect(source).toContain("work(lockedAdapter(tx))"); expect(source).not.toContain("work(lockedAdapter(db"); });
  it("preserves BillingPrice and platform models", () => { expect(DELETE_ORDER).not.toContain("BillingPrice"); expect(PRESERVED_MODELS).toEqual(["BillingPrice", "RateLimitBucket", "_prisma_migrations"]); expect(source).toContain('UPDATE "billing_prices" SET "createdByUserId" = NULL'); });
  it("explicitly verifies every user-owned residue model and selected User IDs", () => { expect(USER_OWNED_RESIDUE_MODELS).toEqual(["Session", "MobileSession", "EmailVerificationToken", "UserBranchAccess"]); expect(source).toContain('FROM "users" WHERE "id" IN'); });
  it("retains valid child-first dependency order", () => { const before = (a: string, b: string) => expect(DELETE_ORDER.indexOf(a as never)).toBeLessThan(DELETE_ORDER.indexOf(b as never)); before("VisitPhoto", "CustomerVisit"); before("CustomerVisit", "Lead"); before("Lead", "Customer"); before("PaymentTransaction", "BillingOrder"); before("UserBranchAccess", "User"); before("User", "Company"); });
  it("keeps the defensive SUPER_ADMIN delete predicate", () => expect(source).toContain('"role" <> \'SUPER_ADMIN\''));
});
