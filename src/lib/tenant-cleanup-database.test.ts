import { describe, expect, it } from "vitest";
import { CLEANUP_DATABASE_STAGES, CleanupDatabaseError, classifyCleanupDatabaseError, runCleanupDatabaseStage } from "./tenant-cleanup-database";

describe("safe cleanup database diagnostics", () => {
  it.each(CLEANUP_DATABASE_STAGES)("attributes a raw failure to %s", async stage => {
    const failure = Object.assign(new Error("password=secret SELECT private_data"), {
      code: "P2010",
      meta: { code: "23503", constraint: "orders_companyId_fkey", table: "billing_orders", message: "customer data" },
    });
    const result = runCleanupDatabaseStage(stage, async () => { throw failure; });
    await expect(result).rejects.toMatchObject({
      message: "TENANT_CLEANUP_DATABASE_FAILURE",
      stage,
      details: { prismaCode: "P2010", databaseCode: "23503", constraint: "orders_companyId_fkey", table: "billing_orders" },
    });
    await expect(result).rejects.not.toThrow(/secret|SELECT|customer data/);
  });

  it("rejects unsafe database metadata instead of logging it", () => {
    expect(classifyCleanupDatabaseError({ code: "P2010: raw SQL", meta: { code: "23503; DROP", constraint: "safe\npassword", table: "users private" } })).toEqual({
      prismaCode: undefined, databaseCode: undefined, constraint: undefined, table: undefined,
    });
  });

  it("retains an already classified inner stage", async () => {
    const error = new CleanupDatabaseError("DELETE_COMPANY", { prismaCode: "P2010", databaseCode: "23503" });
    await expect(runCleanupDatabaseStage("VERIFY_RESIDUE", async () => { throw error; })).rejects.toBe(error);
  });
});
