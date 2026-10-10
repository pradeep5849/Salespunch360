export const TENANT_MODELS = [
  "Company", "Branch", "User", "UserBranchAccess", "EmailVerificationToken",
  "Session", "MobileSession", "PushDevice", "Attendance", "LocationPoint",
  "Customer", "CustomerVisit", "VisitPhoto", "Lead", "LeadActivity",
  "LeadDeletionAudit", "FollowUpTask", "SalesTarget", "GeofenceEvent",
  "DailyTravelApproval", "CompanySubscription", "BillingOrder",
  "PaymentTransaction", "BillingAuditEvent", "PendingStorageDeletion",
  "AccountSettings", "FinancialYear", "NumberingSeries", "Vendor", "AccountUnit",
  "AccountCategory", "AccountProduct", "AccountService", "WorkCategory", "WorkPackage",
  "CustomFieldDefinition", "LedgerAccount", "CostCentre", "JournalEntry", "JournalLine",
  "AccountingPeriodLock", "AccountingAuditEvent", "QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationShare", "QuotationAuditEvent", "CommercialAuditEvent", "PaymentReminder", "AdvanceApplication", "SettlementAllocation", "AccountSettlement", "CommercialDocumentLine", "CommercialDocument",
] as const;

/** Child-first order derived from schema.prisma's Restrict foreign keys. */
export const DELETE_ORDER = [
  "PushDevice", "Session", "MobileSession", "EmailVerificationToken",
  "UserBranchAccess", "FollowUpTask", "LeadActivity", "LeadDeletionAudit",
  "GeofenceEvent", "SalesTarget", "DailyTravelApproval", "VisitPhoto",
  "LocationPoint", "PaymentTransaction", "CompanySubscription",
  "BillingAuditEvent", "CustomerVisit", "Lead", "Customer", "Attendance",
  "CommercialAuditEvent", "PaymentReminder", "AdvanceApplication", "SettlementAllocation", "AccountSettlement", "CommercialDocumentLine", "CommercialDocument", "QuotationAuditEvent", "QuotationShare", "QuotationPaymentSchedule", "QuotationAdjustment", "QuotationLine", "QuotationRevision", "QuotationDocument", "AccountingAuditEvent", "JournalLine", "JournalEntry", "AccountingPeriodLock",
  "CostCentre", "LedgerAccount", "CustomFieldDefinition", "WorkPackage", "WorkCategory",
  "AccountProduct", "AccountService", "AccountCategory", "AccountUnit", "Vendor",
  "FinancialYear", "NumberingSeries", "AccountSettings",
  "BillingOrder", "Branch", "User", "Company",
] as const;

export const PRESERVED_MODELS = ["BillingPrice", "RateLimitBucket", "_prisma_migrations"] as const;
export const USER_OWNED_RESIDUE_MODELS = ["Session", "MobileSession", "EmailVerificationToken", "UserBranchAccess"] as const;

export type TenantCount = (typeof TENANT_MODELS)[number];
export type StorageObject =
  | { key: string; source: "Company.logoObjectKey" }
  | { key: string; source: "PendingStorageDeletion.objectKey" }
  | { key: string; source: "VisitPhoto.objectKey" | "VisitPhoto.thumbnailObjectKey"; visitId: string; uploadedByUserId: string };
export type Inventory = {
  company: { id: string; name: string; slug: string; createdAt?: Date; productEdition?: string; subscriptionStatus?: string; trialEndsAt?: Date | null; primaryAdmin?: { name: string; email: string } };
  counts: Record<TenantCount, number>;
  storage: StorageObject[];
};

export interface LockedCleanupDatabase {
  inventory(companyId: string): Promise<Inventory | null>;
  hasSuperAdmin(companyId: string): Promise<boolean>;
  assertTransactionAlive(): Promise<void>;
  queueStorageDeletions(companyId:string,keys:string[]):Promise<void>;
  deleteTenant(companyId: string): Promise<void>;
  verifyTenantAbsent(companyId: string): Promise<boolean>;
}
export interface CleanupDatabase {
  inventory(companyId: string): Promise<Inventory | null>;
  hasSuperAdmin(companyId: string): Promise<boolean>;
  completeStorageDeletion(key:string):Promise<void>;
  recordStorageDeletionFailure(key:string):Promise<void>;
  withLockedTenant<T>(companyId: string, work: (locked: LockedCleanupDatabase) => Promise<T>): Promise<T>;
}
export interface CleanupStorage { delete(key: string): Promise<void> }
export type LockedInventoryGuard = (inventory: Inventory) => void | Promise<void>;

export type CleanupOptions = { companyIds: string[]; execute: boolean; confirmation?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function confirmationFor(companyIds: string[]) {
  if (companyIds.length !== 1) throw new Error("EXECUTE_ONE_TENANT_ONLY");
  return `DELETE_TEST_TENANT_${companyIds[0]}`;
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
  if (execute && companyIds.length !== 1) throw new Error("EXECUTE_ONE_TENANT_ONLY");
  if (execute && confirmation !== confirmationFor(companyIds)) throw new Error("CONFIRMATION_REQUIRED_OR_INCORRECT");
  return { companyIds, execute, confirmation };
}

function pendingKeyIsOwned(key: string, companyId: string) {
  if (key.includes("\\") || key.includes("%")) return false;
  const parts = key.split("/");
  return parts.length >= 3 && parts[0] === "companies" && parts[1] === companyId
    && parts.slice(2).every(part => /^[A-Za-z0-9._-]+$/.test(part) && part !== "." && part !== "..");
}

export function validateStorageOwnership(inventory: Inventory) {
  const companyId = inventory.company.id;
  for (const object of inventory.storage) {
    let expected: string | undefined;
    if (object.source === "Company.logoObjectKey") expected = `Logo/${companyId}.webp`;
    if (object.source === "VisitPhoto.objectKey") expected = `companies/${companyId}/employees/${object.uploadedByUserId}/check-ins/${object.visitId}/photo.webp`;
    if (object.source === "VisitPhoto.thumbnailObjectKey") expected = `companies/${companyId}/employees/${object.uploadedByUserId}/check-ins/${object.visitId}/thumb.webp`;
    if (object.source === "PendingStorageDeletion.objectKey" ? !pendingKeyIsOwned(object.key, companyId) : object.key !== expected)
      throw new Error(`UNSAFE_STORAGE_KEY:${object.source}`);
  }
}

export async function cleanupTenants(db: CleanupDatabase, storage: CleanupStorage, options: CleanupOptions) {
  const inventories: Inventory[] = [];
  for (const companyId of options.companyIds) {
    const inventory = await db.inventory(companyId);
    if (!inventory) throw new Error(`TENANT_NOT_FOUND_OR_ALREADY_CLEANED:${companyId}`);
    if (await db.hasSuperAdmin(companyId)) throw new Error(`SUPER_ADMIN_TENANT_CORRUPTION:${companyId}`);
    validateStorageOwnership(inventory);
    inventories.push(inventory);
  }
  if (!options.execute) return { mode: "DRY_RUN" as const, inventories, storageResults: [] };

  return purgeTenant(db, storage, options.companyIds[0]);
}

/** The single destructive tenant-purge engine used by both the CLI and platform UI. */
export async function purgeTenant(db: CleanupDatabase, storage: CleanupStorage, companyId: string, guard?: LockedInventoryGuard) {
  const inventory=await db.withLockedTenant(companyId, async locked => {
    if (await locked.hasSuperAdmin(companyId)) throw new Error(`SUPER_ADMIN_TENANT_CORRUPTION:${companyId}`);
    const inventory = await locked.inventory(companyId);
    if (!inventory) throw new Error(`TENANT_NOT_FOUND_OR_ALREADY_CLEANED:${companyId}`);
    await guard?.(inventory);
    validateStorageOwnership(inventory);
    await locked.assertTransactionAlive();
    await locked.queueStorageDeletions(companyId,[...new Set(inventory.storage.map(row=>row.key))]);
    await locked.assertTransactionAlive();
    await locked.deleteTenant(companyId);
    if (!(await locked.verifyTenantAbsent(companyId))) throw new Error(`RESIDUE_DETECTED:${companyId}`);
    return inventory;
  });
  // No irreversible file operation occurs until the database transaction commits.
  const storageResults:Array<{companyId:string;key:string;status:"DELETED_OR_MISSING"|"QUEUED_FOR_RETRY"}>=[];
  for(const key of new Set(inventory.storage.map(row=>row.key))){
    try {await storage.delete(key);await db.completeStorageDeletion(key);storageResults.push({companyId,key,status:"DELETED_OR_MISSING"})}
    catch {await db.recordStorageDeletionFailure(key);storageResults.push({companyId,key,status:"QUEUED_FOR_RETRY"})}
  }
  return {mode:"EXECUTE" as const,inventories:[inventory],storageResults};
}
