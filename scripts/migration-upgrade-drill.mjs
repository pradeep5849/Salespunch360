import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const url = new URL(process.env.DIRECT_URL ?? "");
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !url.pathname.endsWith("_upgrade_ci")
)
  throw new Error(
    "Migration upgrade drill requires an isolated local *_upgrade_ci database.",
  );
if (process.env.DATABASE_URL !== process.env.DIRECT_URL)
  throw new Error("Upgrade drill database URLs must match.");
const root = process.cwd(),
  temporary = mkdtempSync(join(tmpdir(), "salespunch-upgrade-"));
const db = new PrismaClient();
const boundary = "20261001110000_a2_general_preferences";
function run(script, cwd, allowFailure = false) {
  const result = spawnSync(process.execPath, [resolve(root, script)], {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0 && !allowFailure)
    throw new Error("Isolated upgrade initialization failed.");
}
function prisma(args, cwd) {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "node_modules/prisma/build/index.js"), ...args],
    { cwd, stdio: "inherit", env: process.env },
  );
  if (result.status !== 0)
    throw new Error("Isolated upgrade migration failed.");
}
try {
  cpSync(join(root, "prisma"), join(temporary, "prisma"), { recursive: true });
  cpSync(join(root, "package.json"), join(temporary, "package.json"));
  symlinkSync(
    join(root, "node_modules"),
    join(temporary, "node_modules"),
    "dir",
  );
  for (const name of readdirSync(join(temporary, "prisma/migrations"))) {
    if (/^\d/.test(name) && name >= boundary)
      rmSync(join(temporary, "prisma/migrations", name), { recursive: true });
  }
  run("scripts/migrate-deploy-safe.mjs", temporary, true);
  run("scripts/repair-a11-a14-runtime.mjs", temporary);
  run("scripts/migrate-deploy-safe.mjs", temporary);
  const company = await db.company.create({
    data: {
      name: "Upgrade fixture",
      slug: "upgrade-fixture",
      productEdition: "SALESPUNCH360_ACCOUNT",
    },
  });
  await db.$executeRaw`INSERT INTO account_settings ("companyId","baseCurrency","updatedAt") VALUES (${company.id}::uuid,'USD',NOW())`;
  const before =
    await db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='account_settings' AND column_name='appLanguage'`;
  if (before.length)
    throw new Error(
      "Previous-version fixture unexpectedly has the new column.",
    );
  prisma(["migrate", "deploy"], root);
  const settings = await db.accountSettings.findUniqueOrThrow({
    where: { companyId: company.id },
  });
  if (
    settings.baseCurrency !== "USD" ||
    settings.appLanguage !== "en" ||
    settings.displayDecimalPlaces !== 2 ||
    settings.dateFormat !== "DD/MM/YYYY" ||
    settings.warnUnsavedChanges !== true ||
    settings.appearance !== "SYSTEM"
  )
    throw new Error(
      "Upgrade did not preserve old values and initialize stable preferences.",
    );
  const prior =
    await db.$queryRaw`SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
  prisma(["migrate", "deploy"], root);
  const repeated =
    await db.$queryRaw`SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
  if (prior[0].count !== repeated[0].count)
    throw new Error("Repeated migration deployment is not idempotent.");
  prisma(["migrate", "status"], root);
  console.info(
    "Previous Account preferences schema upgrade preserved values and passed repeated deployment.",
  );
} finally {
  await db.$disconnect();
  rmSync(temporary, { recursive: true, force: true });
}
