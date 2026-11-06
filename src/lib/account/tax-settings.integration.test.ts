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
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/tax_ci" },
  },
});
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }),
}));
import { saveTaxPreferences } from "./tax-preferences";
import { saveTaxCatalogEntry } from "./tax-catalog";
import { createCommercialDocumentForActor } from "./commercial";
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
const preferences = {
  gst: false,
  hsnSac: false,
  additionalCess: false,
  reverseCharge: false,
  stateOfSupply: false,
  ewayBillNumber: false,
  compositeScheme: false,
  enableTcs: false,
  enableTds: false,
};
const rate = (name: string) => {
  const form = new FormData();
  form.set("name", name);
  form.set("rate", "5");
  return form;
};
describe.skipIf(!url)(
  "atomic tax settings, catalogue and downstream enforcement",
  () => {
    beforeAll(async () => {
      await client.company.create({
        data: {
          id: companyId,
          name: "Tax fixture",
          slug: `tax-${companyId}`,
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
          name: "Tax buyer",
          isAccountCustomer: true,
        },
      });
      await client.accountSettings.create({
        data: {
          companyId,
          transactionDefaults: {
            invoicePrintSettings: { referenceMarker: "retain" },
          },
          itemSettings: { code: "retain" },
        },
      });
    });
    afterAll(async () => {
      await client.$disconnect();
    });
    it("preserves concurrent catalogue and preference saves and unrelated settings", async () => {
      await Promise.all([
        saveTaxCatalogEntry(actor, "RATE", rate("Concurrent rate")),
        saveTaxPreferences(actor, preferences),
      ]);
      const saved = await client.accountSettings.findUniqueOrThrow({
          where: { companyId },
        }),
        defaults = saved.transactionDefaults as Record<string, unknown>;
      expect(defaults.invoicePrintSettings).toEqual({
        referenceMarker: "retain",
      });
      expect(defaults.taxPreferences).toEqual(preferences);
      expect(defaults.taxCatalog).toEqual({
        customRates: [{ name: "Concurrent rate", rate: 5 }],
      });
      expect(saved.itemSettings).toMatchObject({
        code: "retain",
        itemWiseTax: false,
      });
      expect(
        await client.accountingAuditEvent.count({ where: { companyId } }),
      ).toBe(2);
    });
    it("rejects disabled TCS/TDS at the document boundary and requires a composition category", async () => {
      const draft = {
        type: "SALES_INVOICE",
        idempotencyKey: randomUUID(),
        branchId,
        partyId,
        issueDate: "2026-11-05",
        lines: [
          {
            lineType: "CUSTOM",
            itemName: "Service",
            quantity: "1",
            rate: "100",
            taxRate: "0",
          },
        ],
      };
      await expect(
        createCommercialDocumentForActor(actor, { ...draft, tcsRate: "1" }),
      ).rejects.toThrow("TCS_DISABLED");
      await expect(
        createCommercialDocumentForActor(actor, { ...draft, tdsRate: "1" }),
      ).rejects.toThrow("TDS_DISABLED");
      await expect(
        saveTaxPreferences(actor, { ...preferences, compositeScheme: true }),
      ).rejects.toThrow("COMPOSITION_CATEGORY_REQUIRED");
      expect(
        await client.commercialDocument.count({ where: { companyId } }),
      ).toBe(0);
    });
    it("rejects capacity overflow without evicting a saved rate", async () => {
      const customRates = Array.from({ length: 100 }, (_, index) => ({
        name: `Saved ${index}`,
        rate: 5,
      }));
      const saved = await client.accountSettings.findUniqueOrThrow({
        where: { companyId },
      });
      await client.accountSettings.update({
        where: { companyId },
        data: {
          transactionDefaults: {
            ...(saved.transactionDefaults as object),
            taxCatalog: { customRates },
          },
        },
      });
      await expect(
        saveTaxCatalogEntry(actor, "RATE", rate("Overflow")),
      ).rejects.toThrow("TAX_CATALOG_FULL");
      expect(
        (
          await client.accountSettings.findUniqueOrThrow({
            where: { companyId },
          })
        ).transactionDefaults,
      ).toMatchObject({ taxCatalog: { customRates } });
    });
  },
);
