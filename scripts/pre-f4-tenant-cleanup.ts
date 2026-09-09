import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "../src/lib/db";
import { privateStorage } from "../src/lib/storage";
import { cleanupTenants, parseCleanupArgs, TENANT_MODELS, USER_OWNED_RESIDUE_MODELS, type CleanupDatabase, type Inventory, type LockedCleanupDatabase, type TenantCount } from "../src/lib/tenant-cleanup";

type QueryClient = Prisma.TransactionClient | PrismaClient;
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

async function inventory(client: QueryClient, companyId: string): Promise<Inventory | null> {
  const company = await client.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, slug: true, logoObjectKey: true, users: { where: { salesRole: "PRIMARY_ADMIN" }, take: 1, select: { name: true, email: true } } } });
  if (!company) return null;
  const counts = {} as Record<TenantCount, number>;
  for (const model of TENANT_MODELS) {
    const table = tables[model];
    const predicate = model === "Company" ? Prisma.sql`"id" = ${companyId}::uuid` : userOwned.has(table) ? Prisma.sql`"userId" IN (SELECT "id" FROM "users" WHERE "companyId" = ${companyId}::uuid)` : Prisma.sql`"companyId" = ${companyId}::uuid`;
    const [row] = await client.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${Prisma.raw(`"${table}"`)} WHERE ${predicate}`);
    counts[model] = Number(row.count);
  }
  const photos = await client.visitPhoto.findMany({ where: { companyId }, select: { visitId: true, uploadedByUserId: true, objectKey: true, thumbnailObjectKey: true } });
  const pending = await client.pendingStorageDeletion.findMany({ where: { companyId }, select: { objectKey: true } });
  const storage = [
    ...(company.logoObjectKey ? [{ key: company.logoObjectKey, source: "Company.logoObjectKey" as const }] : []),
    ...photos.flatMap(photo => [
      { key: photo.objectKey, source: "VisitPhoto.objectKey" as const, visitId: photo.visitId, uploadedByUserId: photo.uploadedByUserId },
      { key: photo.thumbnailObjectKey, source: "VisitPhoto.thumbnailObjectKey" as const, visitId: photo.visitId, uploadedByUserId: photo.uploadedByUserId },
    ]),
    ...pending.map(row => ({ key: row.objectKey, source: "PendingStorageDeletion.objectKey" as const })),
  ].filter((item, index, all) => all.findIndex(other => other.key === item.key) === index);
  return { company: { id: company.id, name: company.name, slug: company.slug, primaryAdmin: company.users[0] }, counts, storage };
}

const hasSuperAdmin = (client: QueryClient, companyId: string) => client.user.count({ where: { companyId, role: "SUPER_ADMIN" } }).then(Boolean);

function lockedAdapter(tx: Prisma.TransactionClient): LockedCleanupDatabase {
  let selectedUserIds: string[] = [];
  return {
    inventory: companyId => inventory(tx, companyId),
    hasSuperAdmin: companyId => hasSuperAdmin(tx, companyId),
    assertTransactionAlive: async () => { await tx.$queryRaw`SELECT 1`; },
    async deleteTenant(companyId) {
      selectedUserIds = (await tx.user.findMany({ where: { companyId }, select: { id: true } })).map(user => user.id);
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
    },
    async verifyTenantAbsent(companyId) {
      const directTables = [...new Set(Object.values(tables).filter(table => !userOwned.has(table)))];
      for (const table of directTables) {
        const column = table === "companies" ? "id" : "companyId";
        const [row] = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${Prisma.raw(`"${table}"`)} WHERE ${Prisma.raw(`"${column}"`)} = ${companyId}::uuid`);
        if (Number(row.count) !== 0) return false;
      }
      if (selectedUserIds.length) {
        const ids = Prisma.join(selectedUserIds.map(id => Prisma.sql`${id}::uuid`));
        for (const model of USER_OWNED_RESIDUE_MODELS) {
          const [row] = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${Prisma.raw(`"${tables[model]}"`)} WHERE "userId" IN (${ids})`);
          if (Number(row.count) !== 0) return false;
        }
        const [users] = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "users" WHERE "id" IN (${ids})`);
        if (Number(users.count) !== 0) return false;
      }
      return true;
    },
  };
}

const adapter: CleanupDatabase = {
  inventory: companyId => inventory(db, companyId),
  hasSuperAdmin: companyId => hasSuperAdmin(db, companyId),
  withLockedTenant: (companyId, work) => db.$transaction(async tx => {
    const company = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "companies" WHERE "id"=${companyId}::uuid FOR UPDATE`;
    if (!company.length) throw new Error(`TENANT_NOT_FOUND_OR_ALREADY_CLEANED:${companyId}`);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${companyId}, 0))`;
    return work(lockedAdapter(tx));
  }, { maxWait: 15_000, timeout: 300_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
};

async function main() {
  const result = await cleanupTenants(adapter, { delete: key => privateStorage().delete(key) }, parseCleanupArgs(process.argv.slice(2)));
  console.log(JSON.stringify({ ...result, inventories: result.inventories.map(item => ({ ...item, totalRows: Object.values(item.counts).reduce((a, b) => a + b, 0), totalStorageObjects: item.storage.length })) }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "CLEANUP_FAILED"); process.exitCode = 1; }).finally(() => db.$disconnect());
