import { test } from "node:test";
import assert from "node:assert/strict";
import {
  executeStages,
  nativePrismaStage,
  pendingPlan,
} from "./staged-migration.mjs";
const catalog = ["one", "two", "three"].map((name) => ({
  name,
  checksum: name,
}));
const success = (migration) => ({
  migration_name: migration.name,
  checksum: migration.checksum,
  finished_at: "finished",
  rolled_back_at: null,
});
test("backdated pending migration retains successful later history and rolled-back attempts", () => {
  const plan = pendingPlan(catalog, [
    {
      ...success(catalog[0]),
      finished_at: null,
      rolled_back_at: "rolled-back",
    },
    success(catalog[1]),
  ]);
  assert.deepEqual(
    plan.pending.map((m) => m.name),
    ["one", "three"],
  );
});
for (const [label, rows] of [
  ["CHECKSUM_MISMATCH", [{ ...success(catalog[0]), checksum: "wrong" }]],
  ["DUPLICATE_SUCCESS", [success(catalog[0]), success(catalog[0])]],
  ["UNRESOLVED_MIGRATION", [{ ...success(catalog[0]), finished_at: null }]],
  [
    "UNKNOWN_MIGRATION",
    [{ ...success(catalog[0]), migration_name: "unknown" }],
  ],
])
  test(`refuses ${label}`, () =>
    assert.throws(() => pendingPlan(catalog, rows), new RegExp(label)));
test("verifies every stage and never executes already-successful migration", async () => {
  const history = [success(catalog[1])],
    calls = [];
  const result = await executeStages({
    catalog,
    readHistory: async () => history,
    execute: async (m, applied) => {
      calls.push(m.name);
      assert.ok(applied.has("two"));
      history.push(success(m));
    },
    verify: async (m) => calls.push(`verified:${m.name}`),
  });
  assert.deepEqual(calls, ["one", "verified:one", "three", "verified:three"]);
  assert.deepEqual(result, { completed: 2, successful: 3 });
});
test("migration failure prevents next stage and verifier", async () => {
  const history = [],
    calls = [];
  await assert.rejects(
    executeStages({
      catalog,
      readHistory: async () => history,
      execute: async (m) => {
        calls.push(m.name);
        if (m.name === "two") throw new Error("failed");
        history.push(success(m));
      },
      verify: async () => {},
    }),
    /failed/,
  );
  assert.deepEqual(calls, ["one", "two"]);
});
test("verification failure prevents next migration even after SQL success", async () => {
  const history = [],
    calls = [];
  await assert.rejects(
    executeStages({
      catalog,
      readHistory: async () => history,
      execute: async (m) => {
        calls.push(m.name);
        history.push(success(m));
      },
      verify: async () => {
        throw new Error("integrity");
      },
    }),
    /integrity/,
  );
  assert.deepEqual(calls, ["one"]);
});
test("concurrent successful history change stops before execution", async () => {
  let reads = 0,
    executed = false;
  await assert.rejects(
    executeStages({
      catalog,
      readHistory: async () => (++reads === 1 ? [] : [success(catalog[2])]),
      execute: async () => {
        executed = true;
      },
      verify: async () => {},
    }),
    /CONCURRENT_HISTORY_CHANGE/,
  );
  assert.equal(executed, false);
});
test("native rehearsal refuses production destination before spawning process", () => {
  assert.throws(
    () =>
      nativePrismaStage(
        "/unneeded",
        "postgresql://example.invalid/postgres",
        catalog[0],
        new Set(),
      ),
    /LOCAL_REHEARSAL_ONLY/,
  );
});
