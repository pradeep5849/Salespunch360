import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const value = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
let url;
try {
  url = new URL(value ?? "invalid:");
} catch {
  throw new Error(
    "Database connection configuration rejected; sensitive details suppressed.",
  );
}
const local = ["localhost", "127.0.0.1"].includes(url.hostname);
const project = "mranivjvxysycpqpvrss";
const expected =
  url.hostname === `db.${project}.supabase.co` ||
  (url.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(url.username).endsWith(`.${project}`));
if (!local && !expected)
  throw new Error("Expected SalesPunch360 database target required");
if (!local) {
  if (!process.env.SUPABASE_SSL_ROOT_CERT)
    throw new Error("Official public CA path required");
  url.searchParams.set("sslmode", "require");
  url.searchParams.set("sslaccept", "strict");
  url.searchParams.set("sslcert", process.env.SUPABASE_SSL_ROOT_CERT);
}
const db = new PrismaClient({
  datasources: { db: { url: url.href } },
  log: [],
});
try {
  const report = await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout='30s'");
      const [identity] =
        await tx.$queryRaw`SELECT current_setting('transaction_read_only') AS read_only,(current_user NOT IN ('anon','authenticated','service_role','authenticator')) AS backend_role,has_table_privilege(current_user,'public.users','SELECT,INSERT,UPDATE,DELETE') AS backend_user_access`;
      const history =
        await tx.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations`;
      const catalog = readdirSync("prisma/migrations").filter((x) =>
        /^\d{14}_/.test(x),
      );
      const successful = history.filter(
        (x) => x.finished_at && !x.rolled_back_at,
      );
      const applied = new Set(successful.map((x) => x.migration_name));
      const [accounts] =
        await tx.$queryRaw`SELECT count(*)::int AS users,count(*) FILTER(WHERE role::text='SUPER_ADMIN' AND "isActive" AND "companyId" IS NULL AND NULLIF("passwordHash",'') IS NOT NULL)::int AS eligible_super_admins FROM public.users`;
      const [security] =
        await tx.$queryRaw`SELECT (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))) AS api_accessible_tables,(SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) s WHERE s LIKE 'search_path=%')) AS mutable_function_search_paths`;
      for (const model of [
        "user",
        "expenseTransaction",
        "commercialDocument",
        "moneyAccount",
        "journalEntry",
        "quotationDocument",
      ])
        await tx[model].findMany({ take: 1 });
      return {
        ...identity,
        ...accounts,
        ...security,
        successful: applied.size,
        repository_migrations: catalog.length,
        pending: catalog.filter((x) => !applied.has(x)),
        unresolved: history.filter((x) => !x.finished_at && !x.rolled_back_at)
          .length,
        checksum_mismatches: successful.filter(
          (x) =>
            !catalog.includes(x.migration_name) ||
            x.checksum !==
              createHash("sha256")
                .update(
                  readFileSync(
                    `prisma/migrations/${x.migration_name}/migration.sql`,
                  ),
                )
                .digest("hex"),
        ).length,
        full_model_reads: "PASS",
        gateway_exposed_schemas: "NOT ESTABLISHED BY SQL CATALOG",
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 90000 },
  );
  console.log(
    JSON.stringify(
      { ...report, production_writes: false, configuration_changed: false },
      null,
      2,
    ),
  );
  if (
    report.read_only !== "on" ||
    !report.backend_role ||
    !report.backend_user_access ||
    report.unresolved ||
    report.checksum_mismatches
  )
    process.exitCode = 1;
} catch (error) {
  console.error(
    JSON.stringify({
      result: "READ_ONLY_PREFLIGHT_FAILED",
      code: /^P\d{4}$/.test(error?.code ?? "") ? error.code : undefined,
      production_writes: false,
    }),
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
