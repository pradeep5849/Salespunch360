import { randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
const url = process.env.RESTORE_TEST_DATABASE_URL;
if (
  url &&
  (!["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_ci"))
)
  throw new Error("Isolated local *_ci database required");
const client = new PrismaClient({
  datasources: {
    db: {
      url: url ?? "postgresql://fixture:fixture@127.0.0.1:55432/import_ci",
    },
  },
});
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }),
}));
import {
  saveImportPreviewForActor,
  executeAccountImportForActor,
  type ImportPreview,
} from "./imports";
const companyId = randomUUID(),
  userId = randomUUID(),
  branchId = randomUUID();
const actor = {
  id: userId,
  companyId,
  accountRole: "ACCOUNT_ADMIN",
  branchAccessScope: "ALL_BRANCHES",
};
const plan = (name: string): ImportPreview => ({
  type: "VENDORS",
  fileName: "suppliers.csv",
  fileHash: createHash("sha256").update(name).digest("hex"),
  headers: ["name"],
  rows: [
    {
      rowNumber: 2,
      action: "CREATE",
      values: { name },
      resolved: {},
      errors: [],
      warnings: [],
    },
  ],
  validCount: 1,
  invalidCount: 0,
});
describe.skipIf(!url)("real import confirmation concurrency and scope", () => {
  beforeAll(async () => {
    await client.company.create({
      data: {
        id: companyId,
        name: "Import concurrency fixture",
        slug: `import-${companyId}`,
        productEdition: "SALESPUNCH360_ACCOUNT",
      },
    });
    await client.user.create({
      data: {
        id: userId,
        companyId,
        name: "Fixture",
        email: `${userId}@example.test`,
        passwordHash: "fixture-only",
        role: "ACCOUNT_USER",
        accountRole: "ACCOUNT_ADMIN",
        accountAccessActive: true,
      },
    });
    await client.branch.create({
      data: { id: branchId, companyId, name: "Assigned", code: "A" },
    });
  });
  afterAll(async () => {
    await client.$disconnect();
  });
  it("commits one creation when two confirmations arrive together", async () => {
    const job = await saveImportPreviewForActor(
      actor,
      plan("Exactly once supplier"),
    );
    const results = await Promise.all([
      executeAccountImportForActor(actor, job.id),
      executeAccountImportForActor(actor, job.id),
    ]);
    expect(results.map((x) => x.idempotent).sort()).toEqual([false, true]);
    expect(results.every((x) => x.created === 1)).toBe(true);
    expect(
      await client.vendor.count({
        where: { companyId, name: "Exactly once supplier" },
      }),
    ).toBe(1);
  });
  it("blocks a changed execution plan for already completed raw file bytes", async () => {
    const original = plan("Raw byte replay");
    const first = await saveImportPreviewForActor(actor, original);
    await executeAccountImportForActor(actor, first.id);
    const changed = {
      ...original,
      fileName: "renamed.csv",
      rows: original.rows.map((row) => ({
        ...row,
        values: { name: "Different plan same raw bytes" },
      })),
    };
    const second = await saveImportPreviewForActor(actor, changed);
    expect(second.id).not.toBe(first.id);
    await expect(
      executeAccountImportForActor(actor, second.id),
    ).rejects.toThrow("IMPORT_FILE_ALREADY_COMPLETED");
    expect(
      await client.vendor.count({
        where: { companyId, name: "Different plan same raw bytes" },
      }),
    ).toBe(0);
  });
  it("rejects a persisted customer preview after assigned branch access was removed", async () => {
    const preview: ImportPreview = {
      ...plan("Scoped customer"),
      type: "CUSTOMERS",
      rows: [
        {
          rowNumber: 2,
          action: "CREATE",
          values: { name: "Scoped customer", branch: "A" },
          resolved: { branchId },
          errors: [],
          warnings: [],
        },
      ],
    };
    const job = await saveImportPreviewForActor(actor, preview);
    await expect(
      executeAccountImportForActor(
        { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
        job.id,
      ),
    ).rejects.toThrow("IMPORT_BRANCH_OUTSIDE_SCOPE");
    expect(await client.customer.count({ where: { companyId } })).toBe(0);
  });
});
