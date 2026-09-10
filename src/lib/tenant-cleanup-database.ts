import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "./db";
import { TENANT_MODELS, USER_OWNED_RESIDUE_MODELS, type CleanupDatabase, type Inventory, type LockedCleanupDatabase, type TenantCount } from "./tenant-cleanup";

type QueryClient = Prisma.TransactionClient | PrismaClient;
export const CLEANUP_DATABASE_STAGES = [
  "INVENTORY_COUNT",
  "LOCK_COMPANY",
  "ADVISORY_LOCK",
  "ASSERT_TRANSACTION_ALIVE",
  "DETACH_BILLING_PRICE_CREATOR",
  "CLEAR_LEAD_VISIT_REFERENCES",
  "CLEAR_CUSTOMER_VISIT_REFERENCE",
  "DELETE_ACCOUNT_DATA",
  "DELETE_PUSH_DEVICES",
  "DELETE_SESSIONS",
  "DELETE_MOBILE_SESSIONS",
  "DELETE_EMAIL_VERIFICATION_TOKENS",
  "DELETE_USER_BRANCH_ACCESSES",
  "DELETE_FOLLOW_UP_TASKS",
  "ENABLE_LEAD_ACTIVITY_PURGE_SCOPE",
  "DELETE_LEAD_ACTIVITIES",
  "CLEAR_LEAD_ACTIVITY_PURGE_SCOPE",
  "DELETE_LEAD_DELETION_AUDITS",
  "ENABLE_GEOFENCE_EVENT_PURGE_SCOPE",
  "DELETE_GEOFENCE_EVENTS",
  "CLEAR_GEOFENCE_EVENT_PURGE_SCOPE",
  "DELETE_SALES_TARGETS",
  "DELETE_DAILY_TRAVEL_APPROVALS",
  "DELETE_VISIT_PHOTOS",
  "DELETE_LOCATION_POINTS",
  "DELETE_PAYMENT_TRANSACTIONS",
  "DELETE_COMPANY_SUBSCRIPTIONS",
  "ENABLE_BILLING_AUDIT_PURGE_SCOPE",
  "DELETE_BILLING_AUDIT_EVENTS",
  "CLEAR_BILLING_AUDIT_PURGE_SCOPE",
  "DELETE_CUSTOMER_VISITS",
  "DELETE_LEADS",
  "DELETE_CUSTOMERS",
  "DELETE_ATTENDANCES",
  "DELETE_BILLING_ORDERS",
  "DELETE_PENDING_STORAGE_DELETIONS",
  "DELETE_BRANCHES",
  "DELETE_USERS",
  "DELETE_COMPANY",
  "VERIFY_RESIDUE",
] as const;
export type CleanupDatabaseStage = (typeof CLEANUP_DATABASE_STAGES)[number];

type SafeDatabaseDetails = { prismaCode?: string; databaseCode?: string; constraint?: string; table?: string };
const safeCode = (value: unknown) => typeof value === "string" && /^[A-Z0-9]{2,12}$/i.test(value) ? value : undefined;
const safeIdentifier = (value: unknown) => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(value) ? value : undefined;

/** Contains only allow-listed diagnostic fields; the original database message is deliberately not retained. */
export class CleanupDatabaseError extends Error {
  readonly name = "CleanupDatabaseError";
  constructor(readonly stage: CleanupDatabaseStage, readonly details: SafeDatabaseDetails) {
    super("TENANT_CLEANUP_DATABASE_FAILURE");
  }
}

export function classifyCleanupDatabaseError(error: unknown): SafeDatabaseDetails {
  const candidate = typeof error === "object" && error !== null ? error as Record<string, unknown> : {};
  const meta = typeof candidate.meta === "object" && candidate.meta !== null ? candidate.meta as Record<string, unknown> : {};
  const cause = typeof candidate.cause === "object" && candidate.cause !== null ? candidate.cause as Record<string, unknown> : {};
  return {
    prismaCode: safeCode(candidate.code)?.startsWith("P") ? safeCode(candidate.code) : undefined,
    databaseCode: safeCode(meta.code) ?? safeCode(cause.code),
    constraint: safeIdentifier(meta.constraint) ?? safeIdentifier(meta.constraint_name) ?? safeIdentifier(cause.constraint),
    table: safeIdentifier(meta.table) ?? safeIdentifier(meta.table_name) ?? safeIdentifier(cause.table),
  };
}

export async function runCleanupDatabaseStage<T>(stage: CleanupDatabaseStage, operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof CleanupDatabaseError) throw error;
    throw new CleanupDatabaseError(stage, classifyCleanupDatabaseError(error));
  }
}

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
const deleteStages: Record<string, CleanupDatabaseStage> = {
  push_devices: "DELETE_PUSH_DEVICES", sessions: "DELETE_SESSIONS", mobile_sessions: "DELETE_MOBILE_SESSIONS",
  email_verification_tokens: "DELETE_EMAIL_VERIFICATION_TOKENS", user_branch_accesses: "DELETE_USER_BRANCH_ACCESSES",
  follow_up_tasks: "DELETE_FOLLOW_UP_TASKS", lead_activities: "DELETE_LEAD_ACTIVITIES", lead_deletion_audits: "DELETE_LEAD_DELETION_AUDITS",
  geofence_events: "DELETE_GEOFENCE_EVENTS", sales_targets: "DELETE_SALES_TARGETS", daily_travel_approvals: "DELETE_DAILY_TRAVEL_APPROVALS",
  visit_photos: "DELETE_VISIT_PHOTOS", location_points: "DELETE_LOCATION_POINTS", payment_transactions: "DELETE_PAYMENT_TRANSACTIONS",
  company_subscriptions: "DELETE_COMPANY_SUBSCRIPTIONS", billing_audit_events: "DELETE_BILLING_AUDIT_EVENTS", customer_visits: "DELETE_CUSTOMER_VISITS",
  leads: "DELETE_LEADS", customers: "DELETE_CUSTOMERS", attendances: "DELETE_ATTENDANCES", billing_orders: "DELETE_BILLING_ORDERS",
  pending_storage_deletions: "DELETE_PENDING_STORAGE_DELETIONS", branches: "DELETE_BRANCHES",
};

export async function tenantInventory(client: QueryClient, companyId: string): Promise<Inventory | null> {
  const company = await client.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, slug: true, createdAt: true, productEdition: true, subscriptionStatus: true, trialEndsAt: true, logoObjectKey: true, users: { where: { salesRole: "PRIMARY_ADMIN" }, take: 1, select: { name: true, email: true } } } });
  if (!company) return null;
  const counts = {} as Record<TenantCount, number>;
  for (const model of TENANT_MODELS) {
    const table = tables[model];
    const predicate = model === "Company" ? Prisma.sql`"id" = ${companyId}::uuid` : userOwned.has(table) ? Prisma.sql`"userId" IN (SELECT "id" FROM "users" WHERE "companyId" = ${companyId}::uuid)` : Prisma.sql`"companyId" = ${companyId}::uuid`;
    const [row] = await runCleanupDatabaseStage("INVENTORY_COUNT", () => client.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${Prisma.raw(`"${table}"`)} WHERE ${predicate}`));
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
  return { company: { id: company.id, name: company.name, slug: company.slug, createdAt: company.createdAt, productEdition: company.productEdition, subscriptionStatus: company.subscriptionStatus, trialEndsAt: company.trialEndsAt, primaryAdmin: company.users[0] }, counts, storage };
}

const hasSuperAdmin = (client: QueryClient, companyId: string) => client.user.count({ where: { companyId, role: "SUPER_ADMIN" } }).then(Boolean);

function lockedAdapter(tx: Prisma.TransactionClient, lockedCompanyId: string): LockedCleanupDatabase {
  let selectedUserIds: string[] = [];
  return {
    inventory: companyId => tenantInventory(tx, companyId),
    hasSuperAdmin: companyId => hasSuperAdmin(tx, companyId),
    assertTransactionAlive: async () => { await runCleanupDatabaseStage("ASSERT_TRANSACTION_ALIVE", () => tx.$queryRaw`SELECT 1`); },
    async deleteTenant() {
      const companyId = lockedCompanyId;
      selectedUserIds = (await tx.user.findMany({ where: { companyId }, select: { id: true } })).map(user => user.id);
      const id = Prisma.sql`${companyId}::uuid`;
      await runCleanupDatabaseStage("DETACH_BILLING_PRICE_CREATOR", () => tx.$executeRaw`UPDATE "billing_prices" SET "createdByUserId" = NULL WHERE "createdByUserId" IN (SELECT "id" FROM "users" WHERE "companyId" = ${id})`);
      await runCleanupDatabaseStage("CLEAR_LEAD_VISIT_REFERENCES", () => tx.$executeRaw(Prisma.sql`
        UPDATE "leads"
        SET
          "source" = CASE
            WHEN "source" = 'CUSTOMER_VISIT'::"LeadSource" THEN 'OTHER'::"LeadSource"
            ELSE "source"
          END,
          "sourceVisitId" = NULL,
          "checkInReferenceVisitId" = NULL
        WHERE "companyId" = ${id}
      `));
      await runCleanupDatabaseStage("CLEAR_CUSTOMER_VISIT_REFERENCE", () => tx.$executeRaw`UPDATE "customers" SET "checkInReferenceVisitId"=NULL WHERE "companyId"=${id}`);
      await runCleanupDatabaseStage("DELETE_ACCOUNT_DATA", () => tx.$queryRaw`SELECT set_config('app.account_cleanup_company_id', ${companyId}, true)`);
      await runCleanupDatabaseStage("DELETE_ACCOUNT_DATA", () => tx.$executeRaw`UPDATE "ledger_accounts" SET "parentId"=NULL WHERE "companyId"=${id}`);
      for (const table of ["accounting_audit_events","journal_lines","journal_entries","accounting_period_locks","cost_centres","ledger_accounts","custom_field_definitions","work_packages","work_categories","account_products","account_services","account_categories","account_units","vendors","financial_years","numbering_series","account_settings"]) {
        await runCleanupDatabaseStage("DELETE_ACCOUNT_DATA", () => tx.$executeRaw(Prisma.sql`DELETE FROM ${Prisma.raw(`"${table}"`)} WHERE "companyId"=${id}`));
      }
      await runCleanupDatabaseStage("DELETE_ACCOUNT_DATA", () => tx.$queryRaw`SELECT set_config('app.account_cleanup_company_id', '', true)`);
      const ordered = ["push_devices","sessions","mobile_sessions","email_verification_tokens","user_branch_accesses","follow_up_tasks","lead_activities","lead_deletion_audits","geofence_events","sales_targets","daily_travel_approvals","visit_photos","location_points","payment_transactions","company_subscriptions","billing_audit_events","customer_visits","leads","customers","attendances","billing_orders","pending_storage_deletions","branches"];
      for (const table of ordered) {
        const predicate = userOwned.has(table) ? Prisma.sql`"userId" IN (SELECT "id" FROM "users" WHERE "companyId"=${id})` : Prisma.sql`"companyId"=${id}`;
        const purgeScopeStages = table === "lead_activities"
          ? ["ENABLE_LEAD_ACTIVITY_PURGE_SCOPE", "CLEAR_LEAD_ACTIVITY_PURGE_SCOPE"] as const
          : table === "geofence_events"
            ? ["ENABLE_GEOFENCE_EVENT_PURGE_SCOPE", "CLEAR_GEOFENCE_EVENT_PURGE_SCOPE"] as const
            : table === "billing_audit_events"
              ? ["ENABLE_BILLING_AUDIT_PURGE_SCOPE", "CLEAR_BILLING_AUDIT_PURGE_SCOPE"] as const
              : undefined;
        if (purgeScopeStages) {
          await runCleanupDatabaseStage(purgeScopeStages[0], () => tx.$queryRaw(Prisma.sql`
            SELECT set_config('app.tenant_cleanup_company_id', ${companyId}, true)
          `));
        }
        await runCleanupDatabaseStage(deleteStages[table], () => tx.$executeRaw(Prisma.sql`DELETE FROM ${Prisma.raw(`"${table}"`)} WHERE ${predicate}`));
        if (purgeScopeStages) {
          await runCleanupDatabaseStage(purgeScopeStages[1], () => tx.$queryRaw(Prisma.sql`
            SELECT set_config('app.tenant_cleanup_company_id', '', true)
          `));
        }
      }
      await runCleanupDatabaseStage("DELETE_USERS", () => tx.$executeRaw`DELETE FROM "users" WHERE "companyId"=${id} AND "role" <> 'SUPER_ADMIN'`);
      await runCleanupDatabaseStage("DELETE_COMPANY", () => tx.$executeRaw`DELETE FROM "companies" WHERE "id"=${id}`);
    },
    async verifyTenantAbsent(companyId) {
      const directTables = [...new Set(Object.values(tables).filter(table => !userOwned.has(table)))];
      for (const table of directTables) {
        const column = table === "companies" ? "id" : "companyId";
        const [row] = await runCleanupDatabaseStage("VERIFY_RESIDUE", () => tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${Prisma.raw(`"${table}"`)} WHERE ${Prisma.raw(`"${column}"`)} = ${companyId}::uuid`));
        if (Number(row.count) !== 0) return false;
      }
      if (selectedUserIds.length) {
        const ids = Prisma.join(selectedUserIds.map(id => Prisma.sql`${id}::uuid`));
        for (const model of USER_OWNED_RESIDUE_MODELS) {
          const [row] = await runCleanupDatabaseStage("VERIFY_RESIDUE", () => tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${Prisma.raw(`"${tables[model]}"`)} WHERE "userId" IN (${ids})`));
          if (Number(row.count) !== 0) return false;
        }
        const [users] = await runCleanupDatabaseStage("VERIFY_RESIDUE", () => tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "users" WHERE "id" IN (${ids})`));
        if (Number(users.count) !== 0) return false;
      }
      return true;
    },
  };
}

export const tenantCleanupDatabase: CleanupDatabase = {
  inventory: companyId => tenantInventory(db, companyId),
  hasSuperAdmin: companyId => hasSuperAdmin(db, companyId),
  withLockedTenant: (companyId, work) => db.$transaction(async tx => {
    const company = await runCleanupDatabaseStage("LOCK_COMPANY", () => tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "companies" WHERE "id"=${companyId}::uuid FOR UPDATE`);
    if (!company.length) throw new Error(`TENANT_NOT_FOUND_OR_ALREADY_CLEANED:${companyId}`);
    await runCleanupDatabaseStage("ADVISORY_LOCK", () => tx.$queryRaw<Array<{ locked: number }>>`WITH "company_lock" AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtextextended(${companyId}, 0))) SELECT 1::int AS "locked" FROM "company_lock"`);
    return work(lockedAdapter(tx, company[0].id));
  }, { maxWait: 15_000, timeout: 300_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
};
