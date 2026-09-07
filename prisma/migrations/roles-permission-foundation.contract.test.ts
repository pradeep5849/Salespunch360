import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./20260907000000_roles_permission_foundation/migration.sql", import.meta.url),
  "utf8",
);

describe("F2 roles migration transaction contract", () => {
  it("commits BillingRole.ADMIN before inserting ADMIN billing prices", () => {
    const addAdmin = migration.indexOf(
      `ALTER TYPE "BillingRole" ADD VALUE 'ADMIN';`,
    );
    const commit = migration.indexOf("COMMIT;", addAdmin);
    const billingPricesInsert = migration.indexOf('INSERT INTO "billing_prices"');
    const firstAdminPrice = migration.indexOf("'ADMIN'", billingPricesInsert);

    expect(addAdmin).toBeGreaterThanOrEqual(0);
    expect(commit).toBeGreaterThan(addAdmin);
    expect(billingPricesInsert).toBeGreaterThan(commit);
    expect(firstAdminPrice).toBeGreaterThan(billingPricesInsert);
  });
});
