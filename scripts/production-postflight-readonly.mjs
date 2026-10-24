import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  inspectConnection,
  compareHistory,
} from "./production-readonly-connection.mjs";
import { migrationCatalog } from "./production-prep/staged-migration.mjs";

export async function main() {
  if (
    !inspectConnection(process.env.DIRECT_URL).migration_suitable ||
    !process.env.SUPABASE_SSL_ROOT_CERT
  )
    throw new Error("READ_ONLY_CONNECTION_CONFIGURATION_REQUIRED");
  const url = new URL(process.env.DIRECT_URL);
  url.searchParams.set("sslmode", "require");
  url.searchParams.set("sslaccept", "strict");
  url.searchParams.set("sslcert", process.env.SUPABASE_SSL_ROOT_CERT);
  const { PrismaClient, Prisma } = await import("@prisma/client");
  const db = new PrismaClient({
    datasources: { db: { url: url.href } },
    log: [],
  });
  let phase = "CONNECT_READ_ONLY";
  try {
    const catalog = migrationCatalog(process.cwd());
    const reviewed = JSON.parse(
      readFileSync(
        "docs/production-prep/approved-migration-checksums.json",
        "utf8",
      ),
    );
    if (JSON.stringify(catalog) !== JSON.stringify(reviewed))
      throw new Error("SQL_CHECKSUM_CHANGED");
    const result = await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout='15s'");
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2s'");
        const [identity] =
          await tx.$queryRaw`SELECT current_database() AS database_name, current_setting('transaction_read_only') AS read_only`;
        if (
          identity.database_name !== "postgres" ||
          identity.read_only !== "on"
        )
          throw new Error("IDENTITY_OR_READ_ONLY_MISMATCH");
        phase = "HISTORY_AND_SCHEMA";
        const history = compareHistory(
          catalog,
          await tx.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations`,
        );
        const columns = new Set(
          (
            await tx.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'`
          ).map((c) => `${c.table_name}.${c.column_name}`),
        );
        const missing = Prisma.dmmf.datamodel.models
          .flatMap((m) =>
            m.fields
              .filter((f) => f.kind !== "object")
              .map((f) => `${m.dbName ?? m.name}.${f.dbName ?? f.name}`),
          )
          .filter((c) => !columns.has(c)).length;
        phase = "MODULE_ORM_READS";
        const modules = {};
        // Scalar reads deliberately include full expense model fields, including creationRequestKey.
        // Returned business records stay in memory; only success flags are logged.
        for (const model of [
          "expenseTransaction",
          "expenseCategory",
          "expenseItem",
          "commercialDocument",
          "accountProduct",
          "vendor",
          "project",
          "moneyAccount",
          "loan",
          "accountSettings",
          "journalEntry",
          "quotationDocument",
          "customer",
        ]) {
          phase = `READ_${model}`;
          await tx[model].findMany({ take: 1 });
          modules[model] = "PASS";
        }
        phase = "ACCOUNT_AND_FINANCIAL_AGGREGATES";
        const [accounts] =
          await tx.$queryRaw`SELECT count(*)::int AS users, count(*) FILTER (WHERE role::text='SUPER_ADMIN' AND "isActive" AND "companyId" IS NULL AND NULLIF("passwordHash",'') IS NOT NULL)::int AS eligible_super_admins FROM public.users`;
        const [integrity] =
          await tx.$queryRaw`SELECT (SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated)::int AS invalid_constraints, (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relnamespace='public'::regnamespace AND (NOT i.indisvalid OR NOT i.indisready))::int AS invalid_indexes, (SELECT count(*) FROM (SELECT j.id FROM journal_entries j JOIN journal_lines l ON l."journalEntryId"=j.id AND l."companyId"=j."companyId" WHERE j.status::text='POSTED' GROUP BY j.id HAVING SUM(l.debit)<>SUM(l.credit)) q)::int AS unbalanced_posted_journals`;
        return {
          history,
          missing_runtime_columns: missing,
          modules,
          ...accounts,
          ...integrity,
        };
      },
      { isolationLevel: "RepeatableRead", timeout: 180000, maxWait: 15000 },
    );
    const pass =
      result.history.successful === 148 &&
      !result.history.pending.length &&
      !result.history.unresolved &&
      !result.history.checksum_mismatches &&
      !result.history.unknown &&
      !result.history.duplicate_successes &&
      !result.missing_runtime_columns &&
      result.users === 7 &&
      result.eligible_super_admins === 1 &&
      !result.invalid_constraints &&
      !result.invalid_indexes &&
      !result.unbalanced_posted_journals;
    console.log(
      JSON.stringify(
        {
          result: pass ? "READ_ONLY_POSTFLIGHT_PASS" : "REVIEW_REQUIRED",
          ...result,
          production_writes: false,
          application_browser_or_password_verified: false,
        },
        null,
        2,
      ),
    );
    if (!pass) process.exitCode = 1;
  } catch (error) {
    console.error(
      JSON.stringify({
        result: "READ_ONLY_POSTFLIGHT_FAILED",
        phase,
        prisma_code: /^P[0-9]{4}$/.test(error?.code ?? error?.errorCode ?? "")
          ? (error.code ?? error.errorCode)
          : undefined,
        production_writes: false,
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
      "Read-only postflight refused; sensitive details suppressed.",
    );
    process.exitCode = 1;
  });
