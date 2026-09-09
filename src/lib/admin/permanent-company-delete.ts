import { requireRole, requireRoleForMutation } from "@/lib/auth/authorization";
import { privateStorage } from "@/lib/storage";
import { tenantCleanupDatabase } from "@/lib/tenant-cleanup-database";
import { purgeTenant, validateStorageOwnership, type CleanupDatabase, type CleanupStorage, type Inventory } from "@/lib/tenant-cleanup";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const STORAGE_OWNERSHIP_BLOCKED = "Deletion blocked because tenant storage ownership could not be verified.";
export type PermanentDeletePreview = { company: Inventory["company"]; counts: Inventory["counts"]; totalRows: number; totalStorageObjects: number };
function validId(companyId: string) { if (!UUID.test(companyId)) throw new Error("INVALID_COMPANY_ID"); }

export async function previewPermanentCompanyDelete(companyId: string, database: CleanupDatabase = tenantCleanupDatabase): Promise<PermanentDeletePreview> {
  await requireRole("SUPER_ADMIN");
  validId(companyId);
  const inventory = await database.inventory(companyId);
  if (!inventory) throw new Error("TENANT_NOT_FOUND_OR_ALREADY_CLEANED");
  if (await database.hasSuperAdmin(companyId)) throw new Error("SUPER_ADMIN_TENANT_CORRUPTION");
  try { validateStorageOwnership(inventory); } catch { throw new Error(STORAGE_OWNERSHIP_BLOCKED); }
  return { company: inventory.company, counts: inventory.counts, totalRows: Object.values(inventory.counts).reduce((sum, count) => sum + count, 0), totalStorageObjects: inventory.storage.length };
}

export async function permanentlyDeleteCompany(companyId: string, typedConfirmation: string, database: CleanupDatabase = tenantCleanupDatabase, storage: CleanupStorage = { delete: key => privateStorage().delete(key) }) {
  await requireRoleForMutation("SUPER_ADMIN");
  validId(companyId);
  return purgeTenant(database, storage, companyId, inventory => {
    if (typedConfirmation !== `DELETE ${inventory.company.slug}`) throw new Error("PERMANENT_DELETE_CONFIRMATION_INCORRECT");
  });
}
