import { test } from "node:test";
import assert from "node:assert/strict";
import { assertApproval } from "./run-approved-production-stages.mjs";
const sha = "a".repeat(40),
  connection =
    "postgresql://postgres.mranivjvxysycpqpvrss:synthetic@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
const env = {
  GITHUB_ACTIONS: "true",
  GITHUB_SHA: sha,
  APPROVED_HEAD: sha,
  MIGRATION_AUTHORIZATION: "APPLY_59_REVIEWED_MIGRATIONS_WITHOUT_BACKUP",
  WRITERS_PAUSED: "true",
  SUPABASE_SSL_ROOT_CERT: "/public-ca.crt",
};
test("accepts matching explicit approval for validated destination", () =>
  assert.doesNotThrow(() => assertApproval(env, connection)));
for (const [field, value] of [
  ["GITHUB_ACTIONS", "false"],
  ["APPROVED_HEAD", "b".repeat(40)],
  ["MIGRATION_AUTHORIZATION", ""],
  ["WRITERS_PAUSED", "false"],
  ["SUPABASE_SSL_ROOT_CERT", ""],
])
  test(`rejects missing/incorrect ${field}`, () =>
    assert.throws(() =>
      assertApproval({ ...env, [field]: value }, connection),
    ));
test("refuses transaction pooler and different project", () => {
  assert.throws(() =>
    assertApproval(env, connection.replace(":5432", ":6543")),
  );
  assert.throws(() =>
    assertApproval(
      env,
      connection.replace("mranivjvxysycpqpvrss", "unrelated"),
    ),
  );
});
