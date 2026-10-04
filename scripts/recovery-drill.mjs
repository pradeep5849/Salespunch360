import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
function isolated(value, suffix) {
  const url = new URL(value ?? "");
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !url.pathname.endsWith(suffix)
  )
    throw new Error("Recovery drill requires isolated local database names.");
  return url.href;
}
const source = isolated(process.env.DIRECT_URL, "_ci"),
  target = isolated(process.env.RESTORE_DRILL_DATABASE_URL, "_restore_drill");
if (source === target)
  throw new Error("Recovery source and target must differ.");
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(
      `${command} failed; inspect the isolated runner without printing connection credentials.`,
    );
  return result.stdout.trim();
}
const directory = mkdtempSync(join(tmpdir(), "salespunch-restore-"));
const backup = join(directory, "database.dump");
const started = Date.now();
try {
  run("pg_dump", ["--dbname", source, "--format=custom", "--file", backup]);
  run("pg_restore", [
    "--dbname",
    target,
    "--no-owner",
    "--no-privileges",
    "--exit-on-error",
    backup,
  ]);
  const query = `SELECT md5(string_agg("migration_name" || ':' || ("finished_at" IS NOT NULL)::text, ',' ORDER BY "migration_name")) FROM "_prisma_migrations"`;
  const before = run("psql", [
    source,
    "-XAt",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    query,
  ]);
  const after = run("psql", [
    target,
    "-XAt",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    query,
  ]);
  if (!before || before !== after)
    throw new Error("Restored migration state differs.");
  for (const table of ["Company", "User", "Branch"]) {
    // Prisma maps these model tables to lowercase plural names.
    const names = { Company: "companies", User: "users", Branch: "branches" };
    const sql = `SELECT count(*) FROM "${names[table]}"`;
    if (
      run("psql", [source, "-XAt", "-c", sql]) !==
      run("psql", [target, "-XAt", "-c", sql])
    )
      throw new Error("Restored row counts differ.");
  }
  console.info(
    `Isolated backup/restore drill passed in ${Date.now() - started}ms. This is not a production recovery certification.`,
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
