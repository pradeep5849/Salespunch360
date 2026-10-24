import { createHash } from "node:crypto";
import { readdirSync, readFileSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const project = "mranivjvxysycpqpvrss";
export function inspectConnection(value) {
  if (!value) return { present: false, usable: false, reason: "MISSING" };
  try {
    const url = new URL(value);
    const postgres = ["postgres:", "postgresql:"].includes(url.protocol);
    const session =
      url.hostname.endsWith(".pooler.supabase.com") && url.port === "5432";
    const transaction =
      url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543";
    const direct =
      url.hostname === `db.${project}.supabase.co` &&
      ["", "5432"].includes(url.port);
    const target =
      direct ||
      ((session || transaction) &&
        decodeURIComponent(url.username).endsWith(`.${project}`));
    const namespace = url.searchParams.get("schema") ?? "public";
    const insecure =
      url.searchParams.get("sslmode") === "disable" ||
      url.searchParams.get("sslaccept") === "accept_invalid_certs";
    const usable =
      postgres &&
      target &&
      namespace === "public" &&
      url.pathname === "/postgres" &&
      Boolean(url.password) &&
      !insecure;
    return {
      present: true,
      usable,
      expected_project: target,
      expected_pooler_region:
        direct || /-ap-south-1\.pooler\.supabase\.com$/.test(url.hostname),
      endpoint: session
        ? "SESSION_POOLER_5432"
        : transaction
          ? "TRANSACTION_POOLER_6543"
          : direct
            ? "DIRECT_POSTGRES_5432"
            : "UNSUPPORTED",
      migration_suitable: usable && (session || direct),
      reason: usable
        ? "VALIDATED_WITHOUT_DISCLOSING_VALUE"
        : "CONNECTION_CONFIGURATION_REJECTED",
    };
  } catch {
    return { present: true, usable: false, reason: "INVALID_URL" };
  }
}

export function compareHistory(catalog, history) {
  const known = new Map(catalog.map((m) => [m.name, m.checksum]));
  const successful = history.filter((h) => h.finished_at && !h.rolled_back_at);
  const applied = new Set(successful.map((h) => h.migration_name));
  const unresolved = history.filter(
    (h) => !h.finished_at && !h.rolled_back_at,
  ).length;
  const mismatches = successful.filter(
    (h) => known.get(h.migration_name) !== h.checksum,
  ).length;
  const unknown = history.filter((h) => !known.has(h.migration_name)).length;
  return {
    successful: applied.size,
    pending: catalog.filter((m) => !applied.has(m.name)).map((m) => m.name),
    unresolved,
    checksum_mismatches: mismatches,
    unknown,
    duplicate_successes: successful.length - applied.size,
    rolled_back_attempts: history.filter((h) => h.rolled_back_at).length,
  };
}

function emit(report) {
  const safe = JSON.stringify(report, null, 2);
  console.log(safe);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Read-only production connection verification\n\n\`\`\`json\n${safe}\n\`\`\`\n`,
    );
}

export async function main() {
  const candidates = Object.fromEntries(
    ["DIRECT_URL", "DATABASE_URL"].map((key) => [
      key,
      inspectConnection(process.env[key]),
    ]),
  );
  const automatic =
    ["DIRECT_URL", "DATABASE_URL"].find(
      (key) => candidates[key].migration_suitable,
    ) ?? ["DIRECT_URL", "DATABASE_URL"].find((key) => candidates[key].usable);
  const requested = process.env.VERIFY_CONNECTION_SECRET ?? "auto";
  const selected =
    requested === "auto"
      ? automatic
      : ["DIRECT_URL", "DATABASE_URL"].includes(requested) &&
          candidates[requested].usable
        ? requested
        : undefined;
  if (!selected) {
    emit({ result: "BLOCKED", candidates, production_writes: false });
    process.exitCode = 1;
    return;
  }
  const { PrismaClient, Prisma } = await import("@prisma/client");
  const connection = new URL(process.env[selected]);
  connection.searchParams.set("sslmode", "require");
  connection.searchParams.set("sslaccept", "strict");
  if (process.env.SUPABASE_SSL_ROOT_CERT)
    connection.searchParams.set("sslcert", process.env.SUPABASE_SSL_ROOT_CERT);
  let phase = "CONNECT_READ_ONLY";
  const client = new PrismaClient({
    datasources: { db: { url: connection.href } },
    log: [],
  });
  try {
    const result = await client.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout='15s'");
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2s'");
        const [identity] =
          await tx.$queryRaw`SELECT current_database() AS database_name, current_setting('server_version_num')::int AS server_version_num, current_setting('transaction_read_only') AS read_only`;
        if (
          identity.read_only !== "on" ||
          identity.database_name !== "postgres"
        )
          throw new Error("READ_ONLY_IDENTITY_FAILED");
        const history =
          await tx.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations`;
        const [users] =
          await tx.$queryRaw`SELECT count(*)::int AS application_users, count(*) FILTER (WHERE role::text='SUPER_ADMIN')::int AS super_admins, count(*) FILTER (WHERE role::text='SUPER_ADMIN' AND "isActive" AND "companyId" IS NULL AND NULLIF("passwordHash",'') IS NOT NULL)::int AS eligible_super_admins FROM public.users`;
        const [auth] =
          await tx.$queryRaw`SELECT count(*)::int AS auth_users FROM auth.users`;
        const columns =
          await tx.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'`;
        return { identity, history, users, auth, columns };
      },
      { isolationLevel: "RepeatableRead", timeout: 60000, maxWait: 15000 },
    );
    const catalog = readdirSync("prisma/migrations")
      .filter((name) => /^\d{14}_[a-z0-9_]+$/.test(name))
      .sort()
      .map((name) => ({
        name,
        checksum: createHash("sha256")
          .update(readFileSync(`prisma/migrations/${name}/migration.sql`))
          .digest("hex"),
      }));
    const comparison = compareHistory(catalog, result.history);
    const expected = JSON.parse(
      readFileSync(
        "docs/production-prep/expected-production-pending-migrations.json",
        "utf8",
      ),
    );
    const actual = new Set(
      result.columns.map((c) => `${c.table_name}.${c.column_name}`),
    );
    const missing = Prisma.dmmf.datamodel.models
      .flatMap((m) =>
        m.fields
          .filter((f) => f.kind !== "object")
          .map((f) => `${m.dbName ?? m.name}.${f.dbName ?? f.name}`),
      )
      .filter((c) => !actual.has(c)).length;
    const pass =
      catalog.length === 148 &&
      comparison.successful === 89 &&
      comparison.pending.length === 59 &&
      JSON.stringify(comparison.pending) === JSON.stringify(expected) &&
      !comparison.unresolved &&
      !comparison.checksum_mismatches &&
      !comparison.unknown &&
      !comparison.duplicate_successes &&
      result.users.application_users === 7 &&
      result.users.super_admins === 1 &&
      result.users.eligible_super_admins === 1;
    emit({
      result: pass ? "PASS" : "REVIEW_REQUIRED",
      candidates,
      reused_secret: selected,
      session_pooler_5432:
        candidates[selected].endpoint === "SESSION_POOLER_5432",
      native_migration_connection_suitable:
        candidates[selected].migration_suitable,
      database_identity: result.identity,
      repository_migrations: catalog.length,
      ...comparison,
      pending: comparison.pending.length,
      exact_pending_sequence_matches:
        JSON.stringify(comparison.pending) === JSON.stringify(expected),
      ...result.users,
      ...result.auth,
      missing_runtime_columns: missing,
      original_password_verified: false,
      production_writes: false,
    });
    if (!pass) process.exitCode = 1;
  } catch (error) {
    // Raw Prisma errors can contain hostnames, user names, URLs or row data.
    emit({
      result: "BLOCKED",
      reason: "READ_ONLY_CONNECTION_OR_QUERY_FAILED",
      phase,
      prisma_code: /^P[0-9]{4}$/.test(error?.code ?? error?.errorCode ?? "")
        ? (error.code ?? error.errorCode)
        : undefined,
      tls_error: /certificate|TLS|SSL/i.test(error?.message ?? ""),
      authentication_error:
        /authentication failed|password authentication|P1000/i.test(
          error?.message ?? "",
        ),
      network_error: /reach database|timed out|connection refused|P1001/i.test(
        error?.message ?? "",
      ),
      database_code: /^[A-Z0-9]{5}$/.test(error?.meta?.code ?? "")
        ? error.meta.code
        : undefined,
      candidates,
      reused_secret: selected,
      production_writes: false,
    });
    process.exitCode = 1;
  } finally {
    await client.$disconnect();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error(
      "Read-only verification failed; sensitive diagnostics suppressed.",
    );
    process.exitCode = 1;
  });
