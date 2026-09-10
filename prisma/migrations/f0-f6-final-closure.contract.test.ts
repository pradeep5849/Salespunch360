import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql=readFileSync("prisma/migrations/20260909020000_f0_f6_final_closure/migration.sql","utf8");
const tables=["attendances","location_points","customers","customer_visits","leads","follow_up_tasks","sales_targets","daily_travel_approvals","geofence_events"];
describe("F5 fresh operational Branch migration",()=>{
  it("adds and requires Branch ownership with tenant-composite foreign keys",()=>{for(const table of tables){expect(sql).toContain(`ALTER TABLE "${table}" ADD COLUMN "branchId" UUID`);expect(sql).toContain(`ALTER TABLE "${table}" ALTER COLUMN "branchId" SET NOT NULL`);expect(sql).toContain(`FOREIGN KEY ("companyId", "branchId")`)}});
  it("fails if the fresh-rollout empty-table assumption is false",()=>{expect(sql).toContain("F5 fresh rollout refused: unexpected operational rows exist");for(const table of tables)expect(sql).toContain(`'${table}'`)});
  it("never guesses historical ownership or creates fallback triggers",()=>{expect(sql).not.toMatch(/UPDATE "(?:attendances|location_points|customers|customer_visits|leads|follow_up_tasks|sales_targets|daily_travel_approvals|geofence_events)"/);expect(sql).not.toContain("resolve_operational_branch")});
  it("does not erase operational history",()=>expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i));
});
