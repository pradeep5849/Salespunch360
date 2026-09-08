import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./20260908010000_minimal_employee_profile/migration.sql", import.meta.url),
  "utf8",
);

describe("minimal employee profile migration", () => {
  it("adds only nullable designation and date-of-joining columns", () => {
    expect(migration).toContain('ADD COLUMN "designation" VARCHAR(120)');
    expect(migration).toContain('ADD COLUMN "dateOfJoining" DATE');
    expect(migration).not.toMatch(/NOT NULL|DROP|RENAME|UPDATE|DELETE|INSERT|CREATE TABLE/i);
    expect((migration.match(/ADD COLUMN/g) ?? [])).toHaveLength(2);
  });
});
