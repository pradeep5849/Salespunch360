import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("prisma/migrations/20260909010000_f4_product_trials_plus/migration.sql", "utf8");
describe("F4-1 additive migration", () => {
  it("adds a nonnegative package quantity without destructive statements", () => {
    expect(sql).toContain('ADD COLUMN "accountPackageQuantity" INTEGER NOT NULL DEFAULT 0');
    expect(sql).toContain('CHECK ("accountPackageQuantity" >= 0)');
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE|ALTER TYPE/i);
  });
});
