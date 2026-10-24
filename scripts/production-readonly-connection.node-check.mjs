import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inspectConnection,
  compareHistory,
} from "./production-readonly-connection.mjs";
const fixture =
  "postgresql://postgres.mranivjvxysycpqpvrss:synthetic@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
test("identifies session pooler without leaking fixture credentials", () => {
  const result = inspectConnection(fixture);
  assert.equal(result.migration_suitable, true);
  assert.equal(result.endpoint, "SESSION_POOLER_5432");
  assert.ok(!JSON.stringify(result).includes("synthetic"));
});
test("transaction mode is not migration suitable", () =>
  assert.equal(
    inspectConnection(fixture.replace(":5432", ":6543")).migration_suitable,
    false,
  ));
test("rejects different project", () =>
  assert.equal(
    inspectConnection(fixture.replace("mranivjvxysycpqpvrss", "unrelated"))
      .usable,
    false,
  ));
test("rejects disabled certificate verification", () =>
  assert.equal(
    inspectConnection(fixture + "?sslaccept=accept_invalid_certs").usable,
    false,
  ));
test("rejects missing or invalid input without echoing it", () => {
  assert.equal(inspectConnection(undefined).present, false);
  assert.equal(inspectConnection("sensitive invalid value").usable, false);
});
test("separates successful and rolled-back attempts and checks checksum", () => {
  const catalog = [
    { name: "a", checksum: "x" },
    { name: "b", checksum: "y" },
  ];
  const result = compareHistory(catalog, [
    {
      migration_name: "a",
      checksum: "x",
      finished_at: "yes",
      rolled_back_at: null,
    },
    {
      migration_name: "b",
      checksum: "y",
      finished_at: null,
      rolled_back_at: "yes",
    },
  ]);
  assert.equal(result.successful, 1);
  assert.deepEqual(result.pending, ["b"]);
  assert.equal(result.unresolved, 0);
  assert.equal(result.checksum_mismatches, 0);
});
test("detects unresolved and tampered history", () => {
  const result = compareHistory(
    [{ name: "a", checksum: "x" }],
    [
      { migration_name: "a", checksum: "wrong", finished_at: "yes" },
      { migration_name: "b" },
    ],
  );
  assert.equal(result.checksum_mismatches, 1);
  assert.equal(result.unknown, 1);
  assert.equal(result.unresolved, 1);
});
