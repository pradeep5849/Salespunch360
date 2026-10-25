import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

export function migrationCatalog(root) {
  return readdirSync(join(root, "prisma/migrations"))
    .filter((name) => /^\d{14}_[a-z0-9_]+$/.test(name))
    .sort()
    .map((name) => ({
      name,
      checksum: createHash("sha256")
        .update(
          readFileSync(join(root, "prisma/migrations", name, "migration.sql")),
        )
        .digest("hex"),
    }));
}

export function pendingPlan(catalog, history) {
  const known = new Map(catalog.map((m) => [m.name, m.checksum]));
  const applied = new Set();
  for (const row of history) {
    if (!known.has(row.migration_name)) throw new Error("UNKNOWN_MIGRATION");
    if (row.rolled_back_at) continue;
    if (!row.finished_at) throw new Error("UNRESOLVED_MIGRATION");
    if (known.get(row.migration_name) !== row.checksum)
      throw new Error("CHECKSUM_MISMATCH");
    if (applied.has(row.migration_name)) throw new Error("DUPLICATE_SUCCESS");
    applied.add(row.migration_name);
  }
  return { applied, pending: catalog.filter((m) => !applied.has(m.name)) };
}

// Each execute call must use native Prisma. Never simulate its history with manual inserts.
export async function executeStages({
  catalog,
  readHistory,
  execute,
  verify,
  event = () => {},
}) {
  const initial = pendingPlan(catalog, await readHistory());
  let expected = new Set(initial.applied);
  for (const migration of initial.pending) {
    const before = pendingPlan(catalog, await readHistory());
    if (
      before.applied.size !== expected.size ||
      [...expected].some((n) => !before.applied.has(n))
    )
      throw new Error("CONCURRENT_HISTORY_CHANGE");
    event({ migration: migration.name, state: "START" });
    await execute(migration, expected);
    const after = pendingPlan(catalog, await readHistory());
    expected = new Set([...expected, migration.name]);
    if (
      after.applied.size !== expected.size ||
      [...expected].some((n) => !after.applied.has(n))
    )
      throw new Error("STAGE_HISTORY_MISMATCH");
    await verify(migration);
    event({ migration: migration.name, state: "VERIFIED" });
  }
  return { completed: initial.pending.length, successful: expected.size };
}

export function nativePrismaStage(
  root,
  url,
  migration,
  applied,
  productionGuard,
) {
  const target = new URL(url);
  // This implementation is intentionally rehearsal-only, even if production secrets appear later.
  if (
    !["127.0.0.1", "localhost"].includes(target.hostname) ||
    !/^\/sp_staged_[a-f0-9]{8}_rehearsal$/.test(target.pathname)
  )
    if (
      typeof productionGuard !== "function" ||
      productionGuard(target) !== true
    )
      throw new Error("LOCAL_REHEARSAL_ONLY");
  const directory = mkdtempSync(join(tmpdir(), "salespunch-stage-"));
  try {
    mkdirSync(join(directory, "prisma/migrations"), { recursive: true });
    cpSync(
      join(root, "prisma/schema.prisma"),
      join(directory, "prisma/schema.prisma"),
    );
    cpSync(
      join(root, "prisma/migrations/migration_lock.toml"),
      join(directory, "prisma/migrations/migration_lock.toml"),
    );
    for (const name of [...applied, migration.name])
      cpSync(
        join(root, "prisma/migrations", name),
        join(directory, "prisma/migrations", name),
        { recursive: true },
      );
    const result = spawnSync(
      process.execPath,
      [
        resolve(root, "node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
        "--schema",
        join(directory, "prisma/schema.prisma"),
      ],
      {
        cwd: directory,
        env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
        encoding: "utf8",
        timeout: 120000,
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    // Do not expose raw database errors or connection strings.
    if (result.status !== 0 || result.error)
      throw new Error("NATIVE_MIGRATION_FAILED_STOP_REQUIRED");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
