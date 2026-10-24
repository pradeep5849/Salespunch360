import { PrismaClient, Prisma } from "@prisma/client";
import { hash, verify } from "@node-rs/argon2";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  executeStages,
  migrationCatalog,
  nativePrismaStage,
} from "./staged-migration.mjs";

const root = process.cwd(),
  catalog = migrationCatalog(root);
if (catalog.length !== 148) throw new Error("REVIEW_MIGRATION_INVENTORY");
const name = `sp_staged_${randomBytes(4).toString("hex")}_rehearsal`;
const local = (args) =>
  execFileSync(
    "docker",
    [
      "--host=unix:///var/run/docker.sock",
      "exec",
      "salespunch360-implementation-db",
      ...args,
    ],
    {
      env: {
        ...process.env,
        DOCKER_HOST: undefined,
        DOCKER_CONTEXT: undefined,
        DOCKER_TLS: undefined,
        DOCKER_TLS_VERIFY: undefined,
        DOCKER_CERT_PATH: undefined,
      },
    },
  );
local(["sh", "-c", 'createdb -U "$POSTGRES_USER" "$1"', "sh", name]);
const url = local([
  "sh",
  "-c",
  'printf "postgresql://%s:%s@127.0.0.1:55432/%s" "$POSTGRES_USER" "$POSTGRES_PASSWORD" "$1"',
  "sh",
  name,
]).toString();
const temporary = mkdtempSync(join(tmpdir(), "sp-staged-baseline-"));
const db = new PrismaClient({ datasources: { db: { url } } });
try {
  mkdirSync(join(temporary, "prisma/migrations"), { recursive: true });
  cpSync(
    join(root, "prisma/schema.prisma"),
    join(temporary, "prisma/schema.prisma"),
  );
  cpSync(
    join(root, "prisma/migrations/migration_lock.toml"),
    join(temporary, "prisma/migrations/migration_lock.toml"),
  );
  for (const m of catalog.slice(0, 89))
    cpSync(
      join(root, "prisma/migrations", m.name),
      join(temporary, "prisma/migrations", m.name),
      { recursive: true },
    );
  const baseline = spawnSync(
    process.execPath,
    [resolve(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"],
    {
      cwd: temporary,
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
      encoding: "utf8",
      timeout: 120000,
    },
  );
  if (baseline.status !== 0) throw new Error("LOCAL_BASELINE_FAILED");
  const password = `${randomBytes(24).toString("base64url")}!aA9`,
    encoded = await hash(password);
  const id = randomUUID();
  await db.$executeRaw`INSERT INTO users(id,name,email,"passwordHash",role,"updatedAt","emailVerifiedAt") VALUES (${id}::uuid,'Synthetic staged administrator',${`${name}@example.invalid`},${encoded},'SUPER_ADMIN',NOW(),NOW())`;
  const columns =
    await db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`;
  const projection = columns
    .map((c) => `u."${c.column_name.replaceAll('"', '""')}"`)
    .join(",");
  const fingerprintSql = `SELECT md5(COALESCE(string_agg(jsonb_build_array(${projection})::text,'|' ORDER BY u.id),'')) AS digest FROM users u`;
  const [{ digest }] = await db.$queryRawUnsafe(fingerprintSql);
  const events = [],
    started = Date.now();
  const result = await executeStages({
    catalog,
    readHistory: () =>
      db.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations"`,
    execute: async (migration, applied) =>
      nativePrismaStage(root, url, migration, applied),
    verify: async () => {
      const [current] = await db.$queryRawUnsafe(fingerprintSql);
      if (current.digest !== digest) throw new Error("PROTECTED_USERS_CHANGED");
      const [constraints] =
        await db.$queryRaw`SELECT count(*)::int AS invalid FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated`;
      const [indexes] =
        await db.$queryRaw`SELECT count(*)::int AS invalid FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relnamespace='public'::regnamespace AND (NOT i.indisvalid OR NOT i.indisready)`;
      if (constraints.invalid || indexes.invalid)
        throw new Error("INVALID_INTEGRITY_OBJECT");
    },
    event: (entry) => {
      events.push(entry);
      console.log(`${entry.state} ${entry.migration}`);
    },
  });
  const admin = await db.user.findUniqueOrThrow({ where: { id } });
  if (
    !(await verify(admin.passwordHash, password)) ||
    admin.role !== "SUPER_ADMIN" ||
    admin.companyId !== null ||
    !admin.isActive
  )
    throw new Error("FIXTURE_PASSWORD_OR_ELIGIBILITY_FAILED");
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
    .filter((name) => !actual.has(name));
  if (missing.length) throw new Error("MISSING_RUNTIME_COLUMNS");
  const replay = await executeStages({
    catalog,
    readHistory: () =>
      db.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations"`,
    execute: async () => {
      throw new Error("REPLAY_MUST_NOT_EXECUTE");
    },
    verify: async () => {},
  });
  const evidence = {
    synthetic_only: true,
    production_writes: false,
    baseline: "89 chronological files, not exact production applied set",
    ...result,
    verified_stage_events: events.filter((e) => e.state === "VERIFIED").length,
    duration_ms: Date.now() - started,
    protected_users_unchanged_after_every_stage: true,
    fixture_original_password_and_eligibility: true,
    missing_runtime_columns: missing.length,
    repeated_run: replay,
  };
  const directory = "/workspace/work/production-prep-evidence";
  writeFileSync(
    join(directory, "staged-migration-rehearsal-results.json"),
    JSON.stringify(evidence, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(JSON.stringify(evidence, null, 2));
} catch {
  console.error(
    "LOCAL_STAGED_REHEARSAL_FAILED; no production connection was used; inspect isolated evidence privately.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
  rmSync(temporary, { recursive: true, force: true });
}
