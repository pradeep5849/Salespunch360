import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PrismaClient, Prisma } from "@prisma/client";
import {
  executeStages,
  migrationCatalog,
  nativePrismaStage,
  pendingPlan,
} from "./staged-migration.mjs";
export function assertReadinessApproval(env, source) {
  let url;
  try {
    url = new URL(source ?? "");
  } catch {
    throw new Error("TARGET_REJECTED");
  }
  if (
    env.READINESS_LOCAL_REHEARSAL === "true" &&
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
    url.pathname.endsWith("_readiness_ci")
  )
    return url;
  const ref = "mranivjvxysycpqpvrss";
  const direct =
    url.hostname === `db.${ref}.supabase.co` && ["", "5432"].includes(url.port);
  const session =
    url.hostname.endsWith("-ap-south-1.pooler.supabase.com") &&
    url.port === "5432" &&
    decodeURIComponent(url.username).endsWith(`.${ref}`);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    (!direct && !session) ||
    url.pathname !== "/postgres" ||
    (url.searchParams.get("schema") ?? "public") !== "public"
  )
    throw new Error("TARGET_REJECTED");
  if (
    env.GITHUB_ACTIONS !== "true" ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "") ||
    env.APPROVED_HEAD !== env.GITHUB_SHA
  )
    throw new Error("EXACT_HEAD_APPROVAL_REQUIRED");
  if (
    env.READINESS_AUTHORIZATION !==
      "APPLY_11_TESTED_READINESS_FIXES_WITHOUT_BACKUP" ||
    env.ACKNOWLEDGE_NO_BACKUP !== "true"
  )
    throw new Error("EXPLICIT_NO_BACKUP_AUTHORIZATION_REQUIRED");
  if (!env.SUPABASE_SSL_ROOT_CERT) throw new Error("VERIFIED_CA_REQUIRED");
  url.searchParams.set("sslmode", "require");
  url.searchParams.set("sslaccept", "strict");
  url.searchParams.set("sslcert", env.SUPABASE_SSL_ROOT_CERT);
  url.searchParams.set("connect_timeout", "15");
  return url;
}
export async function main() {
  const url = assertReadinessApproval(
    process.env,
    process.env.DIRECT_URL ?? process.env.READINESS_DATABASE_URL,
  );
  const db = new PrismaClient({
    datasources: { db: { url: url.href } },
    log: [],
  });
  let stage = null;
  const catalog = migrationCatalog(process.cwd());
  const approved = JSON.parse(
    readFileSync("docs/production-readiness/migration-catalog.json", "utf8"),
  );
  try {
    if (
      catalog.length !== 159 ||
      JSON.stringify(catalog) !== JSON.stringify(approved)
    )
      throw new Error("REVIEWED_SQL_CHANGED");
    const history = () =>
      db.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
          return tx.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations`;
        },
        { timeout: 30000, maxWait: 15000 },
      );
    const initial = pendingPlan(catalog, await history());
    if (
      initial.applied.size !== 148 ||
      initial.pending.length !== 11 ||
      initial.pending.some((x) => !x.name.startsWith("20261025"))
    )
      throw new Error("BASELINE_CHANGED_REVIEW_REQUIRED");
    const snapshot = () =>
      db.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
          await tx.$executeRawUnsafe("SET LOCAL statement_timeout='30s'");
          const users = (
            await tx.$queryRaw`SELECT to_jsonb(u) AS row FROM public.users u ORDER BY u.id`
          ).map((record) => record.row);
          const digest = createHash("sha256")
            .update(JSON.stringify(users))
            .digest("hex");
          const [integrity] =
            await tx.$queryRaw`SELECT (SELECT count(*)::int FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated) AS invalid_constraints,(SELECT count(*)::int FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relnamespace='public'::regnamespace AND (NOT i.indisvalid OR NOT i.indisready)) AS invalid_indexes,(SELECT count(*)::int FROM (SELECT j.id FROM journal_entries j JOIN journal_lines l ON l."journalEntryId"=j.id AND l."companyId"=j."companyId" WHERE j.status::text='POSTED' GROUP BY j.id HAVING sum(l.debit)<>sum(l.credit))q) AS unbalanced_journals`;
          const [ownership] =
            await tx.$queryRaw`SELECT (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS nonowned_tables,(SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS nonowned_functions`;
          const functions =
            await tx.$queryRaw`SELECT proname,prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY proname`;
          const [grants] =
            await tx.$queryRaw`SELECT (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE')) AS service_tables,(SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))) AS api_tables`;
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
          return {
            digest,
            users: users.length,
            eligible: users.filter(
              (u) =>
                u.role === "SUPER_ADMIN" &&
                u.isActive &&
                u.companyId === null &&
                u.passwordHash,
            ).length,
            functions: createHash("sha256")
              .update(JSON.stringify(functions))
              .digest("hex"),
            ...integrity,
            ...ownership,
            ...grants,
            missing,
          };
        },
        { isolationLevel: "RepeatableRead", timeout: 90000 },
      );
    const reviewedBodies = JSON.parse(
      readFileSync(
        "docs/production-readiness/reviewed-function-bodies.json",
        "utf8",
      ),
    );
    const actualBodies =
      await db.$queryRaw`SELECT p.proname AS name,pg_get_function_identity_arguments(p.oid) AS identity_args,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') AS checksum FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)`;
    if (
      JSON.stringify(
        actualBodies.map((x) => [x.name, x.identity_args, x.checksum]).sort(),
      ) !==
      JSON.stringify(
        reviewedBodies.map((x) => [x.name, x.identity_args, x.checksum]).sort(),
      )
    )
      throw new Error("FUNCTION_BASELINE_CHANGED");
    const plannedIndexNames = initial.pending.flatMap((m) => {
      const sql = readFileSync(
        `prisma/migrations/${m.name}/migration.sql`,
        "utf8",
      );
      return [...sql.matchAll(/CREATE INDEX CONCURRENTLY "([^"]+)"/g)].map(
        (x) => x[1],
      );
    });
    const currentIndexNames = new Set(
      (
        await db.$queryRaw`SELECT indexname FROM pg_indexes WHERE schemaname='public'`
      ).map((x) => x.indexname),
    );
    if (plannedIndexNames.some((name) => currentIndexNames.has(name)))
      throw new Error("INDEX_BASELINE_CHANGED");
    const before = await snapshot();
    if (
      before.users !== 7 ||
      before.eligible !== 1 ||
      before.invalid_constraints ||
      before.invalid_indexes ||
      before.unbalanced_journals ||
      before.missing ||
      before.nonowned_tables ||
      before.nonowned_functions
    )
      throw new Error("PREFLIGHT_FAILED");
    // Metadata-only recovery instructions. No user rows/hashes/credentials are serialized.
    const rollback = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      return tx.$queryRaw`
    SELECT format('GRANT %s ON TABLE %I.%I TO %s%s;',a.privilege_type,n.nspname,c.relname,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(r.rolname) END,CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END) AS sql
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE n.nspname='public' AND c.relkind IN ('r','p') AND (a.grantee=0 OR r.rolname IN ('anon','authenticated'))
    UNION ALL
    SELECT format('GRANT %s ON FUNCTION %I.%I(%s) TO %s%s;',a.privilege_type,n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(r.rolname) END,CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE n.nspname='public' AND (a.grantee=0 OR r.rolname IN ('anon','authenticated'))
    UNION ALL SELECT format('ALTER FUNCTION %I.%I(%s) RESET search_path;',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) v WHERE v LIKE 'search_path=%')
    UNION ALL SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT %s ON %s TO %s%s;',owner.rolname,a.privilege_type,CASE d.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'f' THEN 'FUNCTIONS' WHEN 'S' THEN 'SEQUENCES' END,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(r.rolname) END,CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END) FROM pg_default_acl d JOIN pg_roles owner ON owner.oid=d.defaclrole CROSS JOIN LATERAL aclexplode(d.defaclacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE d.defaclrole=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype IN ('r','f','S') AND (a.grantee=0 OR r.rolname IN ('anon','authenticated'))
  `;
    });
    // This reviewed baseline has the PostgreSQL standard global PUBLIC EXECUTE default.
    const global =
      await db.$queryRaw`SELECT count(*)::int AS changed FROM pg_default_acl WHERE defaclrole=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND defaclnamespace=0 AND defaclobjtype='f'`;
    if (global[0].changed) throw new Error("GLOBAL_DEFAULT_BASELINE_CHANGED");
    const recoveryPath = process.env.READINESS_ROLLBACK_PATH;
    if (!recoveryPath)
      throw new Error("METADATA_RECOVERY_DESTINATION_REQUIRED");
    writeFileSync(
      recoveryPath,
      "-- Metadata recovery only; not a database backup. Review before execution. Never drop indexes or alter migration history automatically.\n" +
        rollback.map((x) => x.sql).join("\n") +
        "\nALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO PUBLIC;\n",
      { mode: 0o600 },
    );
    const result = await executeStages({
      catalog,
      readHistory: history,
      execute: async (migration, applied) => {
        assertReadinessApproval(
          process.env,
          process.env.DIRECT_URL ?? process.env.READINESS_DATABASE_URL,
        );
        stage = migration.name;
        nativePrismaStage(process.cwd(), url.href, migration, applied, () => {
          assertReadinessApproval(
            process.env,
            process.env.DIRECT_URL ?? process.env.READINESS_DATABASE_URL,
          );
          return true;
        });
      },
      verify: async () => {
        const after = await snapshot();
        if (
          after.digest !== before.digest ||
          after.functions !== before.functions ||
          after.users !== 7 ||
          after.eligible !== 1 ||
          after.invalid_constraints ||
          after.invalid_indexes ||
          after.unbalanced_journals ||
          after.missing ||
          after.service_tables !== before.service_tables ||
          after.api_tables !== 0
        )
          throw new Error("POST_STAGE_VERIFICATION_FAILED");
      },
      event: (entry) => console.log(JSON.stringify(entry)),
    });
    for (const m of Prisma.dmmf.datamodel.models)
      await db[m.name[0].toLowerCase() + m.name.slice(1)].findMany({ take: 1 });
    console.log(
      JSON.stringify({
        result: "READINESS_MIGRATIONS_VERIFIED",
        ...result,
        users_preserved: 7,
        eligible_super_admins: 1,
        protected_user_fields_unchanged: true,
        function_bodies_unchanged: true,
        full_models_read: Prisma.dmmf.datamodel.models.length,
        backup_created: false,
        metadata_recovery_saved: true,
        application_deployed: false,
        actual_password_login_verified: false,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        result: "STOPPED_REVIEW_REQUIRED",
        stage,
        reason: /^[A-Z_]+$/.test(error?.message ?? "")
          ? error.message
          : "SENSITIVE_ERROR_SUPPRESSED",
        automatic_retry: false,
      }),
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error("Readiness execution refused; sensitive details suppressed.");
    process.exitCode = 1;
  });
