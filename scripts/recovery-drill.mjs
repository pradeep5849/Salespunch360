import { PrismaClient, Prisma } from "@prisma/client";
import { fingerprint, assertRestoredState } from "./recovery-fingerprint.mjs";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
function isolated(value, suffix) {
  let url;
  try {
    url = new URL(value ?? "");
  } catch {
    throw new Error(
      "Recovery drill requires valid isolated local database URLs.",
    );
  }
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
  if (result.status !== 0) throw new Error("Recovery command failed.");
}
const sourceDb = new PrismaClient({ datasources: { db: { url: source } } }),
  targetDb = new PrismaClient({ datasources: { db: { url: target } } });
const directory = mkdtempSync(join(tmpdir(), "salespunch-restore-"));
const backup = join(directory, "database.dump"),
  started = Date.now();
let phase = "empty-target validation";
// Compare every public table, not just company/user/branch counts. Digests stay
// inside this isolated process: auth data, financial rows and connection URLs
// are never emitted to the console or written to the repository.

try {
  const existing =
    await targetDb.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
  if (existing.length) throw new Error("Restore target is not empty.");
  phase = "consistent source snapshot and dump";
  const expected = await sourceDb.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
      const [{ snapshot }] =
        await tx.$queryRaw`SELECT pg_export_snapshot() AS snapshot`;
      if (typeof snapshot !== "string" || !snapshot.match(/^[0-9A-F-]+$/i))
        throw new Error("Invalid exported snapshot.");
      const state = await fingerprint(tx);
      // pg_dump and the expected data digests see the same MVCC snapshot, even
      // when another local connection writes while the backup is being made.
      run("pg_dump", [
        "--dbname",
        source,
        "--format=custom",
        "--snapshot",
        snapshot,
        "--file",
        backup,
      ]);
      return state;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 600000,
    },
  );
  phase = "restore into empty isolated database";
  run("pg_restore", [
    "--dbname",
    target,
    "--no-owner",
    "--no-privileges",
    "--exit-on-error",
    backup,
  ]);
  phase = "all-table and integrity-object verification";
  const actual = await targetDb.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
      return fingerprint(tx);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 600000,
    },
  );
  assertRestoredState(expected, actual);
  console.info(
    `Isolated backup/restore drill passed: ${actual.rows.length} tables and ${actual.schema.length} integrity objects checked in ${Date.now() - started}ms. Not a production/provider/file-storage recovery certification.`,
  );
} catch {
  console.error(
    `Isolated backup/restore drill failed during ${phase}. Inspect the isolated runner without printing credentials or row data.`,
  );
  process.exitCode = 1;
} finally {
  await Promise.allSettled([sourceDb.$disconnect(), targetDb.$disconnect()]);
  rmSync(directory, { recursive: true, force: true });
}
