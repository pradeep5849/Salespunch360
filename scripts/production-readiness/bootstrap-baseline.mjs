import { PrismaClient } from "@prisma/client";
import {
  mkdtempSync,
  mkdirSync,
  cpSync,
  readdirSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const url = process.env.READINESS_DATABASE_URL;
const parsed = new URL(url ?? "invalid:");
if (
  !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
  !parsed.pathname.endsWith("readiness_ci")
)
  throw new Error("Isolated local readiness_ci target required");
const root = process.cwd();
const db = new PrismaClient({ datasources: { db: { url } }, log: [] });
const stage = mkdtempSync(join(tmpdir(), "readiness-baseline-"));
try {
  const [existing] =
    await db.$queryRaw`SELECT count(*)::int AS tables FROM pg_tables WHERE schemaname='public'`;
  if (existing.tables !== 0)
    throw new Error("Refuse existing target; no reset is performed");
  mkdirSync(join(stage, "prisma/migrations"), { recursive: true });
  cpSync("prisma/schema.prisma", join(stage, "prisma/schema.prisma"));
  cpSync("package.json", join(stage, "package.json"));
  cpSync(
    "prisma/migrations/migration_lock.toml",
    join(stage, "prisma/migrations/migration_lock.toml"),
  );
  const baseline = readdirSync("prisma/migrations").filter(
    (x) => /^\d{14}_/.test(x) && x < "20261025090000",
  );
  if (baseline.length !== 148) throw new Error("Reviewed148baseline required");
  for (const name of baseline)
    cpSync(
      `prisma/migrations/${name}`,
      join(stage, "prisma/migrations", name),
      { recursive: true },
    );
  symlinkSync(join(root, "node_modules"), join(stage, "node_modules"), "dir");
  const run = (script, allowFailure = false) => {
    const result = spawnSync(process.execPath, [resolve(root, script)], {
      cwd: stage,
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
      stdio: "inherit",
    });
    if (result.status !== 0 && !allowFailure)
      throw new Error("Isolated baseline initialization failed");
  };
  run("scripts/migrate-deploy-safe.mjs", true);
  run("scripts/repair-a11-a14-runtime.mjs");
  run("scripts/migrate-deploy-safe.mjs");
  console.log(
    "Fresh isolated148-migration baseline prepared. No production connection or reset.",
  );
} finally {
  await db.$disconnect();
  rmSync(stage, { recursive: true, force: true });
}
