import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PrismaClient, Prisma } from "@prisma/client";
const source = process.env.READINESS_DATABASE_URL;
const url = new URL(source ?? "invalid:");
if (
  !["postgres:", "postgresql:"].includes(url.protocol) ||
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !url.pathname.endsWith("readiness_ci")
)
  throw new Error("New isolated local readiness_ci database required");
const db = new PrismaClient({ datasources: { db: { url: source } }, log: [] });
let passed = 0;
const results = [];
async function check(name, run) {
  await run();
  passed++;
  results.push({ name, status: "PASS" });
}
try {
  const [owner] =
    await db.$queryRaw`SELECT rolsuper AS superuser FROM pg_roles WHERE rolname=current_user`;
  assert.equal(
    owner.superuser,
    true,
    "Local synthetic superuser required; production Supabase postgres is not superuser",
  );
  const [gate] =
    await db.$queryRaw`SELECT count(*)::int AS successful FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  assert.equal(
    gate.successful,
    148,
    "Run this before the new readiness migrations, on the existing148chain",
  );
  const roles =
    await db.$queryRaw`SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')`;
  assert.equal(
    roles.length,
    3,
    "Synthetic Supabase roles must be created in the isolated cluster",
  );
  const { hash, verify } = await import("@node-rs/argon2");
  const password = `synthetic-${randomUUID()}`;
  const passwordHash = await hash(password);
  const count = await db.user.count();
  assert.equal(
    count,
    0,
    "Refuse to add fixtures to a reused/populated database",
  );
  await db.user.createMany({
    data: Array.from({ length: 7 }, (_, n) => ({
      name: `Readiness fixture ${n}`,
      email: `readiness-${n}-${randomUUID()}@example.invalid`,
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: n === 0,
    })),
  });
  const protectedState = async () =>
    createHash("sha256")
      .update(
        JSON.stringify(await db.user.findMany({ orderBy: { id: "asc" } })),
      )
      .digest("hex");
  const before = await protectedState();
  const bodies =
    await db.$queryRaw`SELECT proname,prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY proname`;
  await check(
    "Production-like anonymous grant fixture really permits access",
    async () => {
      assert.equal(
        (
          await db.$queryRaw`SELECT has_table_privilege('anon','public.users','SELECT') AS allowed`
        )[0].allowed,
        true,
      );
    },
  );
  const child = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      env: { ...process.env, DATABASE_URL: source, DIRECT_URL: source },
      stdio: "inherit",
    },
  );
  assert.equal(child.status, 0, "Native Prisma forward migration failed");
  await check(
    "Seven original synthetic identities and password hash unchanged",
    async () => {
      assert.equal(await protectedState(), before);
      assert.equal(await db.user.count(), 7);
      assert.equal(
        await db.user.count({
          where: { role: "SUPER_ADMIN", companyId: null, isActive: true },
        }),
        1,
      );
      const row = await db.user.findFirstOrThrow({
        where: { role: "SUPER_ADMIN", isActive: true },
      });
      assert.equal(await verify(row.passwordHash, password), true);
    },
  );
  await check(
    "anon/authenticated cannot reach backend tables or call application functions",
    async () => {
      for (const role of ["anon", "authenticated"]) {
        const [row] = await db.$queryRawUnsafe(
          `SELECT count(*)::int AS exposed FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND has_table_privilege('${role}',c.oid,'SELECT,INSERT,UPDATE,DELETE')`,
        );
        assert.equal(row.exposed, 0);
        const [f] = await db.$queryRawUnsafe(
          `SELECT count(*)::int AS executable FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND has_function_privilege('${role}',p.oid,'EXECUTE')`,
        );
        assert.equal(f.executable, 0);
        await assert.rejects(
          db.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
            await tx.user.findMany({ take: 1 });
          }),
          (e) => /permission denied/i.test(e.message),
        );
      }
    },
  );
  await check(
    "service_role access is preserved and backend CRUD works",
    async () => {
      const [r] =
        await db.$queryRaw`SELECT has_table_privilege('service_role','public.users','SELECT,INSERT,UPDATE,DELETE') AS allowed`;
      assert.equal(r.allowed, true);
      await db.$transaction(async (tx) => {
        const r = await tx.user.findFirstOrThrow({
          where: { role: "SUPER_ADMIN" },
        });
        await tx.user.update({ where: { id: r.id }, data: { name: r.name } });
      });
    },
  );
  await check(
    "Function bodies and invoker security unchanged; search paths fixed",
    async () => {
      assert.deepEqual(
        await db.$queryRaw`SELECT proname,prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY proname`,
        bodies,
      );
      const [r] =
        await db.$queryRaw`SELECT count(*)::int AS mutable FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.prosecdef OR NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'))`;
      assert.equal(r.mutable, 0);
    },
  );
  await check(
    "Backend-only defaults prevent future accidental API grants",
    async () => {
      await db
        .$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            "CREATE TABLE public.readiness_default_probe(id uuid)",
          );
          await tx.$executeRawUnsafe(
            "CREATE FUNCTION public.readiness_default_probe_fn() RETURNS integer LANGUAGE sql AS 'SELECT 1'",
          );
          const [r] =
            await tx.$queryRaw`SELECT has_table_privilege('anon','public.readiness_default_probe','SELECT') AS table_allowed,has_function_privilege('anon','public.readiness_default_probe_fn()','EXECUTE') AS function_allowed`;
          assert.equal(r.table_allowed, false);
          assert.equal(r.function_allowed, false);
          throw new Error("ROLLBACK_PROBE");
        })
        .catch((e) => {
          if (e.message !== "ROLLBACK_PROBE") throw e;
        });
    },
  );
  await check(
    "No RLS/provider schema change; all application model scalar reads work",
    async () => {
      const [r] =
        await db.$queryRaw`SELECT count(*)::int AS enabled FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity`;
      assert.equal(r.enabled, 0);
      for (const model of Prisma.dmmf.datamodel.models) {
        const delegate = model.name[0].toLowerCase() + model.name.slice(1);
        await db[delegate].findMany({ take: 1 });
      }
    },
  );
  await check(
    "All new index builds are valid and complete; migration checksums match",
    async () => {
      const [r] =
        await db.$queryRaw`SELECT count(*)::int AS invalid FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relnamespace='public'::regnamespace AND (NOT i.indisvalid OR NOT i.indisready)`;
      assert.equal(r.invalid, 0);
      for (const name of readdirSync("prisma/migrations").filter((x) =>
        /^\d{14}_/.test(x),
      )) {
        const row =
          await db.$queryRaw`SELECT checksum FROM _prisma_migrations WHERE migration_name=${name} AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
        assert.equal(row.length, 1);
        assert.equal(
          row[0].checksum,
          createHash("sha256")
            .update(readFileSync(`prisma/migrations/${name}/migration.sql`))
            .digest("hex"),
        );
      }
    },
  );
  console.log(
    JSON.stringify(
      {
        result: "ISOLATED_SECURITY_REHEARSAL_PASS",
        passed,
        failed: 0,
        checks: results,
        production: false,
      },
      null,
      2,
    ),
  );
} finally {
  await db.$disconnect();
}
