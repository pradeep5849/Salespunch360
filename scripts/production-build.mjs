import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);

// The hosting build is the release gate. Never migrate from an HTTP request.
export function productionBuild({ env = process.env, run = spawnSync } = {}) {
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    if (!env[key]) throw new Error(`Production build requires ${key}; values must remain in the hosting environment.`);
    let url;
    try { url = new URL(env[key]); } catch { throw new Error(`${key} is invalid; connection details suppressed.`); }
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error(`${key} must use PostgreSQL.`);
    if (key === "DIRECT_URL" && (url.port === "6543" || url.searchParams.get("pgbouncer") === "true"))
      throw new Error("DIRECT_URL must use a direct or session connection, not a transaction pooler.");
  }
  const prisma = require.resolve("prisma/build/index.js");
  const steps = [
    ["migration deployment", [prisma, "migrate", "deploy"], false],
    ["migration history verification", [prisma, "migrate", "status"], false],
    ["runtime schema verification", ["scripts/check-runtime-schema.mjs"], false],
    ["Next.js build", [require.resolve("next/dist/bin/next"), "build"], true],
  ];
  for (const [label, args, stream] of steps) {
    console.info(`Release gate: ${label}`);
    const result = run(process.execPath, args, { env, stdio: stream ? "inherit" : "pipe", encoding: "utf8" });
    // Prisma connection diagnostics can contain credentials. Do not echo captured output.
    if (result.error || result.status !== 0) throw new Error(`Production build blocked: ${label} failed. Connection details suppressed; inspect migration status in the trusted deployment environment.`);
    console.info(`Release gate passed: ${label}`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { productionBuild(); } catch (error) {
    console.error(error instanceof Error ? error.message : "Production build blocked.");
    process.exitCode = 1;
  }
}
