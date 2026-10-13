import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
const url = process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_ci"))
)
  throw new Error("Isolated local *_ci database required");
const client = new PrismaClient({
  datasources: {
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/checkpoint_ci" },
  },
});
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }),
}));
import {
  assertUnitAccess,
  saveUnitForActor,
  saveUnitConversionForActor,
} from "./units";
import { updateItemSettingsForActor } from "./settings";
import type { ProjectActor } from "./projects";
const companyId = randomUUID(),
  otherCompany = randomUUID(),
  userId = randomUUID();
const actor = {
  id: userId,
  name: "Unit administrator",
  email: `${userId}@example.test`,
  companyId,
  role: "ACCOUNT_USER",
  accountRole: "ACCOUNT_ADMIN",
  isActive: true,
  accountAccessActive: true,
  salesAccessActive: false,
  salesRole: null,
  managerType: null,
  branchAccessScope: "ALL_BRANCHES",
  branchIds: [],
} as ProjectActor;
let units: string[], foreignUnit: string;
describe.skipIf(!url)(
  "A062 shared unit management on isolated PostgreSQL",
  () => {
    beforeAll(async () => {
      await client.company.createMany({
        data: [
          {
            id: companyId,
            name: "Unit fixture",
            slug: `units-${companyId}`,
            productEdition: "SALESPUNCH360_ACCOUNT",
          },
          {
            id: otherCompany,
            name: "Other unit company",
            slug: `units-${otherCompany}`,
            productEdition: "SALESPUNCH360_ACCOUNT",
          },
        ],
      });
      await client.user.create({
        data: {
          id: userId,
          companyId,
          name: "Unit administrator",
          email: `${userId}@example.test`,
          passwordHash: "isolated-fixture",
          role: "ACCOUNT_USER",
          accountRole: "ACCOUNT_ADMIN",
          accountAccessActive: true,
        },
      });
      await client.accountSettings.create({
        data: {
          companyId,
          itemSettings: {
            enabled: true,
            itemUnits: true,
            description: true,
            unitConversions: [],
          },
        },
      });
      units = [];
      for (let i = 0; i < 4; i++)
        units.push(
          (
            await saveUnitForActor(actor, {
              name: `Unit ${i}`,
              symbol: `U${i}`,
            })
          ).id,
        );
      foreignUnit = (
        await client.accountUnit.create({
          data: { companyId: otherCompany, name: "Foreign unit", symbol: "FU" },
        })
      ).id;
    });
    afterAll(async () => {
      await client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
        await tx.accountOperationalAudit.deleteMany({ where: { companyId } });
        await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
        await tx.accountUnit.deleteMany({
          where: { companyId: { in: [companyId, otherCompany] } },
        });
        await tx.accountSettings.deleteMany({ where: { companyId } });
        await tx.user.deleteMany({ where: { companyId } });
        await tx.company.deleteMany({
          where: { id: { in: [companyId, otherCompany] } },
        });
      });
      await client.$disconnect();
    });
    it("keeps both concurrent rules and another settings edit without losing existing settings", async () => {
      await Promise.all([
        saveUnitConversionForActor(actor, {
          baseUnitId: units[0],
          secondaryUnitId: units[1],
          rate: "12",
        }),
        saveUnitConversionForActor(actor, {
          baseUnitId: units[2],
          secondaryUnitId: units[3],
          rate: "99999999999999.9999",
        }),
        updateItemSettingsForActor(actor, {
          enabled: true,
          itemUnits: true,
          quantityDecimals: 4,
        }),
      ]);
      const stored = (
        await client.accountSettings.findUniqueOrThrow({ where: { companyId } })
      ).itemSettings as {
        unitConversions: Array<{ baseUnitId: string; rate: string }>;
        quantityDecimals: number;
        description: boolean;
      };
      expect(stored.unitConversions).toHaveLength(2);
      expect(
        stored.unitConversions.find((row) => row.baseUnitId === units[2])?.rate,
      ).toBe("99999999999999.9999");
      expect(stored.quantityDecimals).toBe(4);
      expect(stored.description).toBe(true);
      expect(
        await client.accountOperationalAudit.count({
          where: { companyId, eventType: "UNIT_CONVERSION_SAVED" },
        }),
      ).toBe(2);
    });
    it("serializes same-pair writes and retries without duplicate rules", async () => {
      const input={baseUnitId:units[0],secondaryUnitId:units[1],rate:"15"};
      await Promise.all([saveUnitConversionForActor(actor,input),saveUnitConversionForActor(actor,{...input,rate:"18"})]);
      const read=async()=>((await client.accountSettings.findUniqueOrThrow({where:{companyId}})).itemSettings as {unitConversions:Array<{baseUnitId:string;secondaryUnitId:string;rate:string}>}).unitConversions;
      const pair=(await read()).filter(rule=>rule.baseUnitId===input.baseUnitId&&rule.secondaryUnitId===input.secondaryUnitId);
      expect(pair).toHaveLength(1);expect(["15","18"]).toContain(pair[0].rate);
      await saveUnitConversionForActor(actor,{...input,rate:pair[0].rate});
      expect((await read()).filter(rule=>rule.baseUnitId===input.baseUnitId&&rule.secondaryUnitId===input.secondaryUnitId)).toEqual(pair);
    });
    it("rolls back both conversion and unit mutations when their audit cannot be persisted", async () => {
      const invalidActor={...actor,id:randomUUID()};
      const original=await client.accountSettings.findUniqueOrThrow({where:{companyId}});
      await expect(saveUnitConversionForActor(invalidActor,{baseUnitId:units[0],secondaryUnitId:units[1],rate:"999"})).rejects.toThrow();
      expect((await client.accountSettings.findUniqueOrThrow({where:{companyId}})).itemSettings).toEqual(original.itemSettings);
      await expect(saveUnitForActor(invalidActor,{name:"Rollback unit",symbol:"RB"})).rejects.toThrow();
      expect(await client.accountUnit.count({where:{companyId,name:"Rollback unit"}})).toBe(0);
    });
    it("denies cross-company updates and conversion references and non-stock roles", async () => {
      await expect(
        saveUnitForActor(actor, { name: "Stolen", symbol: "ST" }, foreignUnit),
      ).rejects.toThrow();
      await expect(
        saveUnitConversionForActor(actor, {
          baseUnitId: units[0],
          secondaryUnitId: foreignUnit,
          rate: "1",
        }),
      ).rejects.toThrow("INVALID_UNIT");
      await expect(
        saveUnitForActor(
          { ...actor, accountRole: "DATA_ENTRY" },
          { name: "Denied", symbol: "DEN" },
        ),
      ).rejects.toThrow();
      expect(
        (
          await client.accountUnit.findUniqueOrThrow({
            where: { id: foreignUnit },
          })
        ).name,
      ).toBe("Foreign unit");
    });
    it("allows Admin and Accountant but rejects Data Entry and Project Manager on direct unit requests", async () => {
      for(const accountRole of ["ACCOUNT_ADMIN","ACCOUNTANT"] as const){
        const allowed={...actor,accountRole};await expect(assertUnitAccess(allowed)).resolves.toBeDefined();
        const saved=await saveUnitForActor(allowed,{name:`Role ${accountRole}`,symbol:accountRole});
        await expect(saveUnitForActor(allowed,{name:`Edited ${accountRole}`,symbol:accountRole},saved.id)).resolves.toMatchObject({id:saved.id});
      }
      for(const accountRole of ["DATA_ENTRY","PROJECT_MANAGER"] as const){
        const denied={...actor,accountRole};await expect(assertUnitAccess(denied)).rejects.toThrow();
        await expect(saveUnitForActor(denied,{name:"Denied role",symbol:"DENIED"})).rejects.toThrow();
        await expect(saveUnitConversionForActor(denied,{baseUnitId:units[0],secondaryUnitId:units[1],rate:"2"})).rejects.toThrow();
      }
    });
    it("rejects unit name/short-name duplicates and invalid conversion precision", async () => {
      await expect(
        saveUnitForActor(actor, { name: "Unit 0", symbol: "NEW" }),
      ).rejects.toThrow("UNIT_NAME_OR_SYMBOL_EXISTS");
      await expect(
        saveUnitForActor(actor, { name: "New name", symbol: "U0" }),
      ).rejects.toThrow("UNIT_NAME_OR_SYMBOL_EXISTS");
      for (const rate of ["0", "-1", "1e3", "0.00001", "123456789012345"])
        await expect(
          saveUnitConversionForActor(actor, {
            baseUnitId: units[0],
            secondaryUnitId: units[1],
            rate,
          }),
        ).rejects.toThrow();
    });
    it("enforces Items and Units switches consistently for reads and every mutation", async () => {
      try {
        for (const policy of [
          { enabled: false, itemUnits: true },
          { enabled: true, itemUnits: false },
        ]) {
          await updateItemSettingsForActor(actor, policy);
          await expect(assertUnitAccess(actor)).rejects.toThrow();
          await expect(
            saveUnitForActor(actor, { name: "Hidden unit", symbol: "HID" }),
          ).rejects.toThrow();
          await expect(
            saveUnitForActor(
              actor,
              { name: "Hidden rename", symbol: "HID" },
              units[0],
            ),
          ).rejects.toThrow();
          await expect(
            saveUnitConversionForActor(actor, {
              baseUnitId: units[0],
              secondaryUnitId: units[1],
              rate: "2",
            }),
          ).rejects.toThrow();
        }
      } finally {
        await updateItemSettingsForActor(actor, {
          enabled: true,
          itemUnits: true,
        });
      }
    });
  },
);
