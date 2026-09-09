export const TENANT_MODELS = [
  "Company", "Branch", "User", "UserBranchAccess", "EmailVerificationToken",
  "Session", "MobileSession", "PushDevice", "Attendance", "LocationPoint",
  "Customer", "CustomerVisit", "VisitPhoto", "Lead", "LeadActivity",
  "LeadDeletionAudit", "FollowUpTask", "SalesTarget", "GeofenceEvent",
  "DailyTravelApproval", "CompanySubscription", "BillingOrder",
  "PaymentTransaction", "BillingAuditEvent", "PendingStorageDeletion",
] as const;

/** Child-first order derived from schema.prisma's Restrict foreign keys. */
export const DELETE_ORDER = [
  "PushDevice", "Session", "MobileSession", "EmailVerificationToken",
  "UserBranchAccess", "FollowUpTask", "LeadActivity", "LeadDeletionAudit",
  "GeofenceEvent", "SalesTarget", "DailyTravelApproval", "VisitPhoto",
  "LocationPoint", "PaymentTransaction", "CompanySubscription",
  "BillingAuditEvent", "CustomerVisit", "Lead", "Customer", "Attendance",
  "BillingOrder", "PendingStorageDeletion", "Branch", "User", "Company",
] as const;

export const PRESERVED_MODELS = ["BillingPrice", "RateLimitBucket", "_prisma_migrations"] as const;

export type TenantCount = (typeof TENANT_MODELS)[number];
export type StorageObject = { key: string; source: "Company.logoObjectKey" | "VisitPhoto.objectKey" | "VisitPhoto.thumbnailObjectKey" | "PendingStorageDeletion.objectKey" };
export type Inventory = {
  company: { id: string; name: string; slug: string; primaryAdmin?: { name: string; email: string } };
  counts: Record<TenantCount, number>;
  storage: StorageObject[];
};

export interface CleanupDatabase {
  inventory(companyId: string): Promise<Inventory | null>;
  hasSuperAdmin(companyId: string): Promise<boolean>;
  deleteTenant(companyId: string): Promise<void>;
  verifyTenantAbsent(companyId: string): Promise<boolean>;
}
export interface CleanupStorage { delete(key: string): Promise<void> }

export type CleanupOptions = { companyIds: string[]; execute: boolean; confirmation?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function confirmationFor(companyIds: string[]) {
  return `DELETE_TEST_TENANTS_${[...companyIds].sort().join("_")}`;
}

export function parseCleanupArgs(argv: string[]): CleanupOptions {
  const companyIds: string[] = [];
  let execute = false, confirmation: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--company-id") companyIds.push(argv[++i] ?? "");
    else if (arg === "--execute") execute = true;
    else if (arg === "--confirmation") confirmation = argv[++i];
    else throw new Error(`UNSUPPORTED_ARGUMENT:${arg}`);
  }
  if (!companyIds.length) throw new Error("COMPANY_ID_REQUIRED");
  if (companyIds.some(id => !UUID.test(id))) throw new Error("INVALID_COMPANY_ID");
  if (new Set(companyIds).size !== companyIds.length) throw new Error("DUPLICATE_COMPANY_ID");
  if (execute && confirmation !== confirmationFor(companyIds)) throw new Error("CONFIRMATION_REQUIRED_OR_INCORRECT");
  return { companyIds, execute, confirmation };
}

export async function cleanupTenants(db: CleanupDatabase, storage: CleanupStorage, options: CleanupOptions) {
  const inventories: Inventory[] = [];
  for (const companyId of options.companyIds) {
    const inventory = await db.inventory(companyId);
    if (!inventory) throw new Error(`TENANT_NOT_FOUND_OR_ALREADY_CLEANED:${companyId}`);
    if (await db.hasSuperAdmin(companyId)) throw new Error(`SUPER_ADMIN_TENANT_CORRUPTION:${companyId}`);
    inventories.push(inventory);
  }
  if (!options.execute) return { mode: "DRY_RUN" as const, inventories, storageResults: [] };

  const storageResults: Array<{ companyId: string; key: string; status: "DELETED_OR_MISSING" | "FAILED" }> = [];
  for (const inventory of inventories) {
    for (const { key } of inventory.storage) {
      try { await storage.delete(key); storageResults.push({ companyId: inventory.company.id, key, status: "DELETED_OR_MISSING" }); }
      catch { storageResults.push({ companyId: inventory.company.id, key, status: "FAILED" }); }
    }
    if (storageResults.some(result => result.companyId === inventory.company.id && result.status === "FAILED"))
      throw new Error(`STORAGE_DELETE_FAILED:${inventory.company.id}`);
    await db.deleteTenant(inventory.company.id);
    if (!(await db.verifyTenantAbsent(inventory.company.id))) throw new Error(`RESIDUE_DETECTED:${inventory.company.id}`);
  }
  return { mode: "EXECUTE" as const, inventories, storageResults };
}
