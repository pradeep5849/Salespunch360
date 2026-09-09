import { Prisma } from "@prisma/client";
import { db } from "../src/lib/db";
import { privateStorage } from "../src/lib/storage";
import { cleanupTenants, parseCleanupArgs, TENANT_MODELS, type Inventory, type TenantCount } from "../src/lib/tenant-cleanup";

const tables: Record<TenantCount, string> = {
  Company: "companies", Branch: "branches", User: "users", UserBranchAccess: "user_branch_accesses",
  EmailVerificationToken: "email_verification_tokens", Session: "sessions", MobileSession: "mobile_sessions",
  PushDevice: "push_devices", Attendance: "attendances", LocationPoint: "location_points", Customer: "customers",
  CustomerVisit: "customer_visits", VisitPhoto: "visit_photos", Lead: "leads", LeadActivity: "lead_activities",
  LeadDeletionAudit: "lead_deletion_audits", FollowUpTask: "follow_up_tasks", SalesTarget: "sales_targets",
  GeofenceEvent: "geofence_events", DailyTravelApproval: "daily_travel_approvals", CompanySubscription: "company_subscriptions",
  BillingOrder: "billing_orders", PaymentTransaction: "payment_transactions", BillingAuditEvent: "billing_audit_events",
  PendingStorageDeletion: "pending_storage_deletions",
};
const userOwned = new Set(["user_branch_accesses", "email_verification_tokens", "sessions", "mobile_sessions"]);

const adapter = {
  async inventory(companyId: string): Promise<Inventory | null> {
    const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, slug: true, logoObjectKey: true, users: { where: { salesRole: "PRIMARY_ADMIN" }, take: 1, select: { name: true, email: true } } } });
    if (!company) return null;
    const counts = {} as Record<TenantCount, number>;
    for (const model of TENANT_MODELS) {
      const table = tables[model];
      const predicate = model === "Company" ? Prisma.sql`"id" = ${companyId}::uuid` : userOwned.has(table) ? Prisma.sql`"userId" IN (SELECT "id" FROM "users" WHERE "companyId" = ${companyId}::uuid)` : Prisma.sql`"companyId" = ${companyId}::uuid`;
      const [row] = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${Prisma.raw(`"${table}"`)} WHERE ${predicate}`);
      counts[model] = Number(row.count);
    }
    const photos = await db.visitPhoto.findMany({ where: { companyId }, select: { objectKey: true, thumbnailObjectKey: true } });
    const pending = await db.pendingStorageDeletion.findMany({ where: { companyId }, select: { objectKey: true } });
    const storage = [
      ...(company.logoObjectKey ? [{ key: company.logoObjectKey, source: "Company.logoObjectKey" as const }] : []),
      ...photos.flatMap(photo => [{ key: photo.objectKey, source: "VisitPhoto.objectKey" as const }, { key: photo.thumbnailObjectKey, source: "VisitPhoto.thumbnailObjectKey" as const }]),
      ...pending.map(row => ({ key: row.objectKey, source: "PendingStorageDeletion.objectKey" as const })),
    ].filter((item, index, all) => all.findIndex(other => other.key === item.key) === index);
    return { company: { id: company.id, name: company.name, slug: company.slug, primaryAdmin: company.users[0] }, counts, storage };
  },
  hasSuperAdmin: (companyId: string) => db.user.count({ where: { companyId, role: "SUPER_ADMIN" } }).then(Boolean),
  async deleteTenant(companyId: string) {
    await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${companyId}, 0))`;
      const id = Prisma.sql`${companyId}::uuid`;
      await tx.$executeRaw`UPDATE "billing_prices" SET "createdByUserId" = NULL WHERE "createdByUserId" IN (SELECT "id" FROM "users" WHERE "companyId" = ${id})`;
      await tx.$executeRaw`UPDATE "leads" SET "sourceVisitId"=NULL, "checkInReferenceVisitId"=NULL WHERE "companyId"=${id}`;
      await tx.$executeRaw`UPDATE "customers" SET "checkInReferenceVisitId"=NULL WHERE "companyId"=${id}`;
      const ordered = ["push_devices","sessions","mobile_sessions","email_verification_tokens","user_branch_accesses","follow_up_tasks","lead_activities","lead_deletion_audits","geofence_events","sales_targets","daily_travel_approvals","visit_photos","location_points","payment_transactions","company_subscriptions","billing_audit_events","customer_visits","leads","customers","attendances","billing_orders","pending_storage_deletions","branches"];
      for (const table of ordered) {
        const predicate = userOwned.has(table) ? Prisma.sql`"userId" IN (SELECT "id" FROM "users" WHERE "companyId"=${id})` : Prisma.sql`"companyId"=${id}`;
        await tx.$executeRaw(Prisma.sql`DELETE FROM ${Prisma.raw(`"${table}"`)} WHERE ${predicate}`);
      }
      await tx.$executeRaw`DELETE FROM "users" WHERE "companyId"=${id} AND "role" <> 'SUPER_ADMIN'`;
      await tx.$executeRaw`DELETE FROM "companies" WHERE "id"=${id}`;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },
  async verifyTenantAbsent(companyId: string) {
    // Company Restrict FKs make a successful parent deletion strong evidence; retain explicit residue queries as defence in depth.
    const directTables = [...new Set(Object.values(tables).filter(table => !userOwned.has(table)))];
    for (const table of directTables) {
      const column = table === "companies" ? "id" : "companyId";
      const [row] = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${Prisma.raw(`"${table}"`)} WHERE ${Prisma.raw(`"${column}"`)} = ${companyId}::uuid`);
      if (Number(row.count) !== 0) return false;
    }
    return true;
  },
};

async function main() {
  const options = parseCleanupArgs(process.argv.slice(2));
  // Keep dry-run independent of storage configuration; resolve the driver only if execute reaches an object deletion.
  const result = await cleanupTenants(adapter, { delete: key => privateStorage().delete(key) }, options);
  console.log(JSON.stringify({ ...result, inventories: result.inventories.map(item => ({ ...item, totalRows: Object.values(item.counts).reduce((a, b) => a + b, 0), totalStorageObjects: item.storage.length })) }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "CLEANUP_FAILED"); process.exitCode = 1; }).finally(() => db.$disconnect());
