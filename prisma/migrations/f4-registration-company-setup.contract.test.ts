import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("prisma/migrations/20260909010000_f4_registration_company_setup/migration.sql", "utf8");
describe("F4 additive setup migration", () => {
  it("preserves existing Sales companies and records", () => {
    expect(sql).toContain('ADD COLUMN "enabledModules"'); expect(sql).toContain("'SALES_CRM'");
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE|UPDATE\s+"(?:attendances|customers|leads|customer_visits|location_points|sales_targets)"/i);
  });
});
