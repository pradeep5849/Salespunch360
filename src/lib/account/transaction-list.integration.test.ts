import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ProjectActor } from "./projects";
const url = process.env.RESTORE_TEST_DATABASE_URL;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_ci"))
)
  throw new Error("Isolated local *_ci database required");
const client = new PrismaClient({
  datasources: {
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/list_ci" },
  },
  log: [{ emit: "event", level: "query" }],
});
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }),
}));
import { listCommercialDocumentsPageForActor } from "./commercial";
const companyId = randomUUID(),
  branchId = randomUUID(),
  userId = randomUUID(),
  partyId = randomUUID();
const actor = {
  id: userId,
  name: "Fixture",
  email: `${userId}@example.test`,
  companyId,
  role: "ACCOUNT_USER",
  isActive: true,
  accountRole: "ACCOUNT_ADMIN",
  accountAccessActive: true,
  salesAccessActive: false,
  salesRole: null,
  managerType: null,
  branchAccessScope: "ALL_BRANCHES",
  branchIds: [],
} as ProjectActor;
let queries = 0;
client.$on("query", () => {
  queries++;
});
describe.skipIf(!url)(
  "bounded transaction list and nonfinancial balances",
  () => {
    beforeAll(async () => {
      await client.company.create({
        data: {
          id: companyId,
          name: "List fixture",
          slug: `list-${companyId}`,
          productEdition: "SALESPUNCH360_ACCOUNT",
        },
      });
      await client.user.create({
        data: {
          id: userId,
          companyId,
          name: actor.name,
          email: actor.email,
          passwordHash: "fixture-only",
          role: "ACCOUNT_USER",
          accountRole: "ACCOUNT_ADMIN",
          accountAccessActive: true,
        },
      });
      await client.branch.create({
        data: { id: branchId, companyId, name: "Main", code: "MAIN" },
      });
      await client.customer.create({
        data: {
          id: partyId,
          companyId,
          branchId,
          name: "List buyer",
          isAccountCustomer: true,
        },
      });
      await client.commercialDocument.createMany({
        data: Array.from({ length: 101 }, (_, index) => ({
          id: randomUUID(),
          companyId,
          branchId,
          partyId,
          customerId: partyId,
          partyName: "List buyer",
          type: "PROFORMA_INVOICE" as const,
          status: "DRAFT" as const,
          documentNumber: `PF-${index}`,
          issueDate: new Date("2026-11-05"),
          createdAt: new Date("2026-11-05T00:00:00Z"),
          subtotal: "100",
          taxableTotal: "100",
          taxTotal: "0",
          grandTotal: "100",
          balanceDue: "100",
          createdById: userId,
        })),
      });
    });
    afterAll(async () => {
      await client.$disconnect();
    });
    it("pages timestamp ties exactly once with bounded reads and no invented collectible balance", async () => {
      const ids: string[] = [];
      let cursor: string | undefined,
        pages = 0;
      do {
        queries = 0;
        const result = await listCommercialDocumentsPageForActor(actor, {
          cursor,
        });
        expect(result.rows.length).toBeLessThanOrEqual(50);
        expect(queries).toBeLessThanOrEqual(3);
        for (const row of result.rows) {
          expect(row.showBalance).toBe(false);
          expect(row.outstanding.toString()).toBe("0");
          ids.push(row.id);
        }
        cursor = result.nextCursor;
        pages++;
      } while (cursor && pages < 4);
      expect(pages).toBe(3);
      expect(ids).toHaveLength(101);
      expect(new Set(ids).size).toBe(101);
    });
    it("denies an out-of-scope cursor and returns no rows for an empty branch grant", async () => {
      const row = await client.commercialDocument.findFirstOrThrow({
        where: { companyId },
      });
      const scoped = {
        ...actor,
        branchAccessScope: "SELECTED_BRANCHES" as const,
        branchIds: [],
      };
      expect((await listCommercialDocumentsPageForActor(scoped)).rows).toEqual(
        [],
      );
      await expect(
        listCommercialDocumentsPageForActor(scoped, { cursor: row.id }),
      ).rejects.toThrow("Not authorized");
    });
  },
);
