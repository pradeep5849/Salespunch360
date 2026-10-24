import { readFileSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { inspectConnection } from "../production-readonly-connection.mjs";
import {
  executeStages,
  migrationCatalog,
  nativePrismaStage,
  pendingPlan,
} from "./staged-migration.mjs";

export function assertApproval(env, connection) {
  if (
    env.GITHUB_ACTIONS !== "true" ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "") ||
    env.APPROVED_HEAD !== env.GITHUB_SHA
  )
    throw new Error("EXACT_HEAD_APPROVAL_REQUIRED");
  if (
    env.MIGRATION_AUTHORIZATION !==
    "APPLY_59_REVIEWED_MIGRATIONS_WITHOUT_BACKUP"
  )
    throw new Error("EXPLICIT_MIGRATION_AUTHORIZATION_REQUIRED");
  if (env.WRITERS_PAUSED !== "true")
    throw new Error("WRITER_MAINTENANCE_CONFIRMATION_REQUIRED");
  if (
    !inspectConnection(connection).migration_suitable ||
    !env.SUPABASE_SSL_ROOT_CERT
  )
    throw new Error("VERIFIED_PRODUCTION_DESTINATION_AND_CA_REQUIRED");
}

export async function main() {
  const source = process.env.DIRECT_URL;
  const preflightOnly = process.env.PRODUCTION_PREFLIGHT_ONLY === "true";
  if (preflightOnly) {
    if (
      process.env.GITHUB_ACTIONS !== "true" ||
      !inspectConnection(source).migration_suitable ||
      !process.env.SUPABASE_SSL_ROOT_CERT
    )
      throw new Error("VERIFIED_READ_ONLY_PREFLIGHT_CONTEXT_REQUIRED");
  } else assertApproval(process.env, source);
  const connection = new URL(source);
  connection.searchParams.set("sslmode", "require");
  connection.searchParams.set("sslaccept", "strict");
  connection.searchParams.set("sslcert", process.env.SUPABASE_SSL_ROOT_CERT);
  connection.searchParams.set("connect_timeout", "15");
  const catalog = migrationCatalog(process.cwd());
  const approved = JSON.parse(
    readFileSync(
      "docs/production-prep/approved-migration-checksums.json",
      "utf8",
    ),
  );
  if (
    catalog.length !== 148 ||
    JSON.stringify(catalog) !== JSON.stringify(approved)
  )
    throw new Error("REVIEWED_SQL_CHANGED");
  const expectedPending = JSON.parse(
    readFileSync(
      "docs/production-prep/expected-production-pending-migrations.json",
      "utf8",
    ),
  );
  const { PrismaClient, Prisma } = await import("@prisma/client");
  const db = new PrismaClient({
    datasources: { db: { url: connection.href } },
    log: [],
  });
  const events = [];
  try {
    const readHistory = () =>
      db.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
          await tx.$executeRawUnsafe("SET LOCAL statement_timeout='15s'");
          return tx.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations`;
        },
        { timeout: 30000 },
      );
    const initial = pendingPlan(catalog, await readHistory());
    // A partial batch requires a new reviewed recovery plan, not automatic continuation.
    if (
      initial.applied.size !== 89 ||
      JSON.stringify(initial.pending.map((m) => m.name)) !==
        JSON.stringify(expectedPending)
    )
      throw new Error("PRODUCTION_BASELINE_CHANGED_REVIEW_REQUIRED");
    const originalColumns =
      await db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`;
    if (!originalColumns.length) throw new Error("USER_SCHEMA_UNAVAILABLE");
    const projection = originalColumns
      .map((c) => `u."${c.column_name.replaceAll('"', '""')}"`)
      .join(",");
    const protectedSql = `SELECT md5(COALESCE(string_agg(jsonb_build_array(${projection})::text,'|' ORDER BY u.id),'')) AS digest FROM public.users u`;
    const snapshot = () =>
      db.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
          await tx.$executeRawUnsafe("SET LOCAL statement_timeout='15s'");
          const [protectedUsers] = await tx.$queryRawUnsafe(protectedSql);
          const [accounts] =
            await tx.$queryRaw`SELECT count(*)::int AS users, count(*) FILTER (WHERE role::text='SUPER_ADMIN' AND "isActive" AND "companyId" IS NULL AND NULLIF("passwordHash",'') IS NOT NULL)::int AS eligible FROM public.users`;
          const [integrity] =
            await tx.$queryRaw`SELECT (SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated)::int AS invalid_constraints, (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relnamespace='public'::regnamespace AND (NOT i.indisvalid OR NOT i.indisready))::int AS invalid_indexes, (SELECT count(*) FROM (SELECT j.id FROM journal_entries j JOIN journal_lines l ON l."journalEntryId"=j.id AND l."companyId"=j."companyId" WHERE j.status::text='POSTED' GROUP BY j.id HAVING SUM(l.debit)<>SUM(l.credit)) q)::int AS unbalanced_journals`;
          return { digest: protectedUsers.digest, ...accounts, ...integrity };
        },
        { isolationLevel: "RepeatableRead", timeout: 60000 },
      );
    const before = await snapshot();
    if (
      before.users !== 7 ||
      before.eligible !== 1 ||
      before.invalid_constraints ||
      before.invalid_indexes ||
      before.unbalanced_journals
    )
      throw new Error("PRODUCTION_PREFLIGHT_FAILED");
    if (preflightOnly) {
      console.log(
        JSON.stringify({
          result: "READ_ONLY_PRODUCTION_GATES_PASS",
          successful: initial.applied.size,
          pending: initial.pending.length,
          application_users: before.users,
          eligible_super_admins: before.eligible,
          invalid_constraints: before.invalid_constraints,
          invalid_indexes: before.invalid_indexes,
          unbalanced_journals: before.unbalanced_journals,
          protected_user_baseline_available: Boolean(before.digest),
          production_writes: false,
        }),
      );
      return;
    }
    const result = await executeStages({
      catalog,
      readHistory,
      execute: async (migration, applied) => {
        assertApproval(process.env, source);
        nativePrismaStage(
          process.cwd(),
          connection.href,
          migration,
          applied,
          () => {
            assertApproval(process.env, source);
            return true;
          },
        );
      },
      verify: async () => {
        const after = await snapshot();
        if (JSON.stringify(before) !== JSON.stringify(after))
          throw new Error("ACCOUNT_OR_INTEGRITY_CHANGE_STOP_REQUIRED");
      },
      event: (entry) => {
        events.push(entry);
        console.log(JSON.stringify(entry));
      },
    });
    const actual = new Set(
      (
        await db.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'`
      ).map((c) => `${c.table_name}.${c.column_name}`),
    );
    const missing = Prisma.dmmf.datamodel.models
      .flatMap((m) =>
        m.fields
          .filter((f) => f.kind !== "object")
          .map((f) => `${m.dbName ?? m.name}.${f.dbName ?? f.name}`),
      )
      .filter((name) => !actual.has(name)).length;
    if (missing || result.successful !== 148 || result.completed !== 59)
      throw new Error("FINAL_SCHEMA_VERIFICATION_FAILED");
    const report = {
      result: "MIGRATIONS_AND_DATABASE_GATES_PASS",
      ...result,
      protected_user_fields_unchanged: true,
      missing_runtime_columns: missing,
      original_password_runtime_verified: false,
      application_runtime_verified: false,
      deployment_executed: false,
    };
    console.log(JSON.stringify(report));
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### Production database migration gates\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`,
      );
  } catch {
    // No raw database message, credential, fingerprint or account row is emitted.
    console.error(
      JSON.stringify({
        result: "STOPPED_REVIEW_REQUIRED",
        last_stage: events.at(-1) ?? null,
        automatic_retry_allowed: false,
      }),
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error(
      "Migration preflight refused execution; credentials and raw errors suppressed.",
    );
    process.exitCode = 1;
  });
