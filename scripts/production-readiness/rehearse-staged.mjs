import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import assert from "node:assert/strict";
import { main } from "./execute.mjs";
const source = process.env.READINESS_DATABASE_URL;
const url = new URL(source ?? "invalid:");
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.pathname !== "/staged_readiness_ci"
)
  throw new Error("Fresh isolated staged_readiness_ci required");
const db = new PrismaClient({ datasources: { db: { url: source } }, log: [] });
try {
  const [r] =
    await db.$queryRaw`SELECT rolsuper AS superuser FROM pg_roles WHERE rolname=current_user`;
  assert.equal(r.superuser, false, "Must test the non-superuser backend owner");
  assert.equal(await db.user.count(), 0);
  const password = `stage-${randomUUID()}`;
  const passwordHash = await hash(password);
  await db.user.createMany({
    data: Array.from({ length: 7 }, (_, n) => ({
      name: `Stage fixture ${n}`,
      email: `stage-${n}-${randomUUID()}@example.invalid`,
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: n === 0,
    })),
  });
  process.env.READINESS_LOCAL_REHEARSAL = "true";
  process.env.DIRECT_URL = source;
  await main();
  assert.notEqual(process.exitCode, 1, "Staged runner failed");
  const row = await db.user.findFirstOrThrow({
    where: { role: "SUPER_ADMIN", isActive: true },
  });
  assert.equal(await verify(row.passwordHash, password), true);
  console.log(
    JSON.stringify({
      result: "NON_SUPERUSER_STAGED_REHEARSAL_PASS",
      users: 7,
      original_synthetic_password_verified: true,
      production: false,
    }),
  );
} finally {
  await db.$disconnect();
}
