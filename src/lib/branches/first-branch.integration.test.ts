import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === "$transaction")
          return (work: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
            client.$transaction((tx) =>
              work(
                new Proxy(tx, {
                  get: (target, property) => {
                    if (property === "accountOperationalAudit")
                      return new Proxy(target.accountOperationalAudit, {
                        get: (delegate, method) => {
                          if (method === "create" && rejectAudit)
                            return async () => {
                              throw new Error("FIXTURE_AUDIT_REJECTED");
                            };
                          const value = Reflect.get(delegate, method);
                          return typeof value === "function"
                            ? value.bind(delegate)
                            : value;
                        },
                      });
                    const value: unknown = Reflect.get(target, property);
                    return typeof value === "function"
                      ? value.bind(target)
                      : value;
                  },
                }),
              ),
            );
        const value: unknown = Reflect.get(client, key);
        return typeof value === "function" ? value.bind(client) : value;
      },
    },
  ),
}));
import { createBranchForOwner, branchCreationSchema } from "./first-branch";
const address = process.env.BRANCH_SETUP_TEST_DATABASE_URL,
  url = new URL(address ?? "postgresql://unused:unused@127.0.0.1/unused_ci");
if (
  address &&
  (!["127.0.0.1", "localhost"].includes(url.hostname) ||
    !url.pathname.endsWith("_ci"))
)
  throw new Error("ISOLATED_LOCAL_CI_DATABASE_REQUIRED");
const client = new PrismaClient({ datasourceUrl: address ?? url.toString() });
let rejectAudit = false;
async function fixture(accountOnly = false) {
  const companyId = randomUUID(),
    ownerId = randomUUID();
  await client.company.create({
    data: {
      id: companyId,
      name: "Branch setup fixture",
      slug: `branch-setup-${companyId}`,
      productEdition: accountOnly
        ? "SALESPUNCH360_ACCOUNT"
        : "SALESPUNCH360_PLUS",
    },
  });
  await client.user.create({
    data: {
      id: ownerId,
      companyId,
      name: "Owner",
      email: `${ownerId}@example.invalid`,
      passwordHash: "PRIVATE",
      role: "COMPANY_ADMIN",
      salesRole: "PRIMARY_ADMIN",
      salesAccessActive: !accountOnly,
      accountRole: "ACCOUNT_ADMIN",
      accountAccessActive: true,
    },
  });
  const primary = await client.branch.create({
    data: {
      companyId,
      name: "Head Office",
      code: "HO",
      isPrimary: true,
      addressLine1: "Old address",
      addressLine2: "Floor 2",
      locality: "Town",
      city: "City",
      phone: "9000000000",
    },
  });
  const customer = await client.customer.create({
    data: { companyId, branchId: primary.id, name: "Existing party" },
  });
  const employee = await client.user.create({
    data: {
      companyId,
      name: "Staff",
      email: `${randomUUID()}@example.invalid`,
      passwordHash: "PRIVATE",
      role: "SALES",
      salesRole: "SALES",
      salesAccessActive: true,
      branchAccessScope: "SELECTED_BRANCHES",
      branchAccesses: { create: { branchId: primary.id } },
    },
  });
  return { companyId, id: ownerId, primary, customer, employee };
}
beforeAll(() => {
  if (address) vi.stubEnv("NODE_ENV", "development");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await client.$disconnect();
});
it("validates explicit optional transition choices and rejects tenant ownership input", () => {
  expect(
    branchCreationSchema.parse({
      name: " Pune ",
      code: " pn ",
      firstBranchAction: "MOVE_EXISTING",
    }),
  ).toMatchObject({ name: "Pune", code: "PN" });
  expect(() =>
    branchCreationSchema.parse({
      name: "Pune",
      code: "PN",
      companyId: randomUUID(),
    }),
  ).toThrow();
  expect(() =>
    branchCreationSchema.parse({
      name: "Pune",
      code: "PN",
      firstBranchAction: "MOVE_ALL_HISTORY",
    }),
  ).toThrow();
});
it.skipIf(!address)(
  "requires a reviewed first-branch choice before changing any branch",
  async () => {
    const f = await fixture();
    await expect(
      createBranchForOwner(f, { name: "Branch", code: "B1" }),
    ).rejects.toThrow("FIRST_BRANCH_CHOICE_REQUIRED");
    expect(
      await client.branch.count({ where: { companyId: f.companyId } }),
    ).toBe(1);
  },
);
it.skipIf(!address)(
  "KEEP retains the original Head Office and puts no existing records in the new branch",
  async () => {
    const f = await fixture(),
      created = await createBranchForOwner(f, {
        name: "Branch",
        code: "B1",
        firstBranchAction: "KEEP_HEAD_OFFICE",
      });
    expect(created.isPrimary).toBe(false);
    expect(created.id).not.toBe(f.primary.id);
    expect(
      (
        await client.customer.findUniqueOrThrow({
          where: { id: f.customer.id },
        })
      ).branchId,
    ).toBe(f.primary.id);
    expect(
      (await client.branch.findUniqueOrThrow({ where: { id: f.primary.id } }))
        .name,
    ).toBe("Head Office");
    expect(
      await client.customer.count({
        where: { companyId: f.companyId, branchId: created.id },
      }),
    ).toBe(0);
  },
);
it.skipIf(!address)(
  "MOVE retains record and staff-assignment identities while creating an empty protected Head Office",
  async () => {
    const f = await fixture(),
      year = await client.financialYear.create({
        data: {
          companyId: f.companyId,
          name: "Fixture",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2027-03-31"),
        },
      }),
      ledger = await client.ledgerAccount.create({
        data: {
          companyId: f.companyId,
          code: "FIX",
          name: "Fixture",
          accountClass: "ASSET",
          normalBalance: "DEBIT",
        },
      });
    const journal = await client.journalEntry.create({
      data: {
        companyId: f.companyId,
        branchId: f.primary.id,
        financialYearId: year.id,
        journalNumber: "J1",
        entryDate: new Date("2026-11-23"),
        sourceType: "FIXTURE",
        sourceId: randomUUID(),
        createdById: f.id,
      },
    });
    await client.journalLine.createMany({
      data: [
        {
          companyId: f.companyId,
          journalEntryId: journal.id,
          ledgerAccountId: ledger.id,
          lineNumber: 1,
          debit: "10",
        },
        {
          companyId: f.companyId,
          journalEntryId: journal.id,
          ledgerAccountId: ledger.id,
          lineNumber: 2,
          credit: "10",
        },
      ],
    });
    await client.journalEntry.update({
      where: { id: journal.id },
      data: { status: "POSTED", postedAt: new Date(), postedById: f.id },
    });
    const before = await client.journalEntry.findUniqueOrThrow({
      where: { id: journal.id },
      include: { lines: true },
    });
    const created = await createBranchForOwner(f, {
      name: "Operating branch",
      code: "OP",
      city: "New city",
      firstBranchAction: "MOVE_EXISTING",
    });
    const after = await client.journalEntry.findUniqueOrThrow({
      where: { id: journal.id },
      include: { lines: true },
    });
    expect(created.id).toBe(f.primary.id);
    expect(created.isPrimary).toBe(false);
    expect(after).toEqual(before);
    expect(
      (
        await client.customer.findUniqueOrThrow({
          where: { id: f.customer.id },
        })
      ).branchId,
    ).toBe(created.id);
    expect(
      await client.userBranchAccess.findMany({
        where: { userId: f.employee.id },
        select: { branchId: true },
      }),
    ).toEqual([{ branchId: created.id }]);
    const head = await client.branch.findFirstOrThrow({
      where: { companyId: f.companyId, isPrimary: true },
    });
    expect(head.id).not.toBe(created.id);
    expect(head).toMatchObject({
      name: "Head Office",
      code: "HO",
      addressLine1: "Old address",
      addressLine2: "Floor 2",
      locality: "Town",
      city: "City",
    });
    expect(
      await client.customer.count({
        where: { companyId: f.companyId, branchId: head.id },
      }),
    ).toBe(0);
    expect(
      await client.journalEntry.count({
        where: { companyId: f.companyId, branchId: head.id },
      }),
    ).toBe(0);
  },
);
it.skipIf(!address)(
  "serializes competing first-branch choices so only one transition can happen",
  async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      createBranchForOwner(f, {
        name: "Keep",
        code: "KEEP",
        firstBranchAction: "KEEP_HEAD_OFFICE",
      }),
      createBranchForOwner(f, {
        name: "Move",
        code: "MOVE",
        firstBranchAction: "MOVE_EXISTING",
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      results
        .filter((r) => r.status === "rejected")
        .map((r) => (r.status === "rejected" ? r.reason.message : "")),
    ).toEqual(["FIRST_BRANCH_SETUP_CHANGED"]);
    expect(
      await client.branch.count({ where: { companyId: f.companyId } }),
    ).toBe(2);
    expect(
      await client.branch.count({
        where: { companyId: f.companyId, isPrimary: true },
      }),
    ).toBe(1);
  },
);
it.skipIf(!address)(
  "rechecks current Main Admin membership rather than trusting caller claims",
  async () => {
    const f = await fixture();
    await expect(
      createBranchForOwner(
        { ...f, id: f.employee.id },
        { name: "Denied", code: "NO", firstBranchAction: "KEEP_HEAD_OFFICE" },
      ),
    ).rejects.toThrow("FORBIDDEN");
    const other = await fixture();
    await expect(
      createBranchForOwner(
        { ...f, id: other.id },
        { name: "Denied", code: "NO", firstBranchAction: "MOVE_EXISTING" },
      ),
    ).rejects.toThrow("FORBIDDEN");
    expect(
      await client.branch.count({ where: { companyId: f.companyId } }),
    ).toBe(1);
  },
);
it.skipIf(!address)(
  "rolls back the primary identity and new Head Office if audit storage fails",
  async () => {
    const f = await fixture();
    rejectAudit = true;
    try {
      await expect(
        createBranchForOwner(f, {
          name: "Move",
          code: "MOVE",
          firstBranchAction: "MOVE_EXISTING",
        }),
      ).rejects.toThrow("FIXTURE_AUDIT_REJECTED");
    } finally {
      rejectAudit = false;
    }
    expect(
      await client.branch.findMany({ where: { companyId: f.companyId } }),
    ).toEqual([f.primary]);
    expect(
      await client.accountOperationalAudit.count({
        where: { companyId: f.companyId },
      }),
    ).toBe(0);
  },
);
it.skipIf(!address)(
  "supports an Account-only Main Admin and later ordinary branch creation",
  async () => {
    const f = await fixture(true);
    await createBranchForOwner(f, {
      name: "First",
      code: "B1",
      firstBranchAction: "KEEP_HEAD_OFFICE",
    });
    const later = await createBranchForOwner(f, { name: "Later", code: "B2" });
    expect(later.isPrimary).toBe(false);
    await expect(
      createBranchForOwner(f, { name: "Duplicate", code: "B2" }),
    ).rejects.toThrow("DUPLICATE_BRANCH_CODE");
    expect(
      await client.branch.count({
        where: { companyId: f.companyId, isPrimary: true },
      }),
    ).toBe(1);
  },
);
