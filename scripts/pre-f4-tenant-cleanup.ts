import { db } from "../src/lib/db";
import { privateStorage } from "../src/lib/storage";
import { tenantCleanupDatabase } from "../src/lib/tenant-cleanup-database";
import { cleanupTenants, parseCleanupArgs } from "../src/lib/tenant-cleanup";

async function main() {
  const result = await cleanupTenants(tenantCleanupDatabase, { delete: key => privateStorage().delete(key) }, parseCleanupArgs(process.argv.slice(2)));
  console.log(JSON.stringify({ ...result, inventories: result.inventories.map(item => ({ ...item, totalRows: Object.values(item.counts).reduce((a, b) => a + b, 0), totalStorageObjects: item.storage.length })) }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "CLEANUP_FAILED"); process.exitCode = 1; }).finally(() => db.$disconnect());
