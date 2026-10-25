import { test } from "node:test";
import assert from "node:assert/strict";
import { assertReadinessApproval } from "./execute.mjs";
const head = "a".repeat(40);
const good = {
  GITHUB_ACTIONS: "true",
  GITHUB_SHA: head,
  APPROVED_HEAD: head,
  READINESS_AUTHORIZATION: "APPLY_11_TESTED_READINESS_FIXES_WITHOUT_BACKUP",
  ACKNOWLEDGE_NO_BACKUP: "true",
  SUPABASE_SSL_ROOT_CERT: "/public-ca.crt",
};
const target =
  "postgresql://postgres.mranivjvxysycpqpvrss:fixture@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
test("exact authorization retains strict verified TLS and expected project", () => {
  const u = assertReadinessApproval(good, target);
  assert.equal(u.searchParams.get("sslaccept"), "strict");
  assert.equal(u.searchParams.get("sslcert"), "/public-ca.crt");
});
for (const [key, value] of [
  ["APPROVED_HEAD", "b".repeat(40)],
  ["GITHUB_ACTIONS", "false"],
  ["READINESS_AUTHORIZATION", ""],
  ["ACKNOWLEDGE_NO_BACKUP", "false"],
  ["SUPABASE_SSL_ROOT_CERT", ""],
])
  test(`refuses missing/mismatched ${key}`, () =>
    assert.throws(() =>
      assertReadinessApproval({ ...good, [key]: value }, target),
    ));
for (const url of [
  "postgresql://postgres.other:fixture@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
  target.replace(":5432", ":6543"),
  target.replace(/\/postgres$/, "/other"),
  target + "?schema=auth",
  "invalid",
])
  test("refuses wrong target without returning credential contents", () =>
    assert.throws(() => assertReadinessApproval(good, url)));
test("local rehearsal flag cannot authorize production", () =>
  assert.throws(() =>
    assertReadinessApproval({ READINESS_LOCAL_REHEARSAL: "true" }, target),
  ));
test("separately guarded isolated staging target does not need production secrets", () =>
  assert.equal(
    assertReadinessApproval(
      { READINESS_LOCAL_REHEARSAL: "true" },
      "postgresql://fixture@127.0.0.1:5432/staged_readiness_ci",
    ).hostname,
    "127.0.0.1",
  ));
