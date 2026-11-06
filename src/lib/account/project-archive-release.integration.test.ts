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
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/close_ci" },
  },
});
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }),
}));
import { createProjectForActor, updateProjectForActor, listProjectsForActor } from "./projects";
import { DEFAULT_LEDGER_ACCOUNTS } from "@/lib/accounting/default-accounts";
import {
  archiveProjectForActor,
  restoreMasterForActor,
} from "./utilities";
const companyId = randomUUID(),
  branchId = randomUUID(),
  userId = randomUUID(),
  yearId = randomUUID();
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
describe.skipIf(!url)("project archive release regression", () => {
  beforeAll(async () => {
    await client.company.create({
      data: {
        id: companyId,
        name: "Close fixture",
        slug: `close-${companyId}`,
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
        branchAccessScope: "ALL_BRANCHES",
      },
    });
    await client.branch.create({
      data: { id: branchId, companyId, name: "Main", code: "MAIN" },
    });
    await client.financialYear.create({
      data: {
        id: yearId,
        companyId,
        name: "FY",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
      },
    });
    for (const row of DEFAULT_LEDGER_ACCOUNTS)
      await client.ledgerAccount.create({
        data: {
          companyId,
          code: row.code,
          name: row.name,
          accountClass: row.accountClass,
          normalBalance: row.normalBalance,
          systemKey: row.systemKey,
          isSystem: row.isSystem,
        },
      });
  });
  beforeAll(async () => {
    await client.accountSettings.create({data:{companyId,enabledModules:["PROJECTS"]}});
  });
  afterAll(async () => {
    await client.$disconnect();
  });

  it("creates and edits, archives without deletion, restores through recycle and preserves prior rows",async()=>{
    const customer=await client.customer.create({data:{companyId,branchId,name:"Release customer",isAccountCustomer:true,phone:"9000000001"}});
    const before=await client.project.count({where:{companyId}});
    const existing=await createProjectForActor(actor,{branchId,customerId:customer.id,name:"Existing project",projectValue:"100"});
    const project=await createProjectForActor(actor,{branchId,customerId:customer.id,name:"New project",projectValue:"200"});
    await updateProjectForActor(actor,{projectId:project.id,name:"Edited project",projectValue:"250",status:"ACTIVE"});
    expect((await listProjectsForActor(actor)).rows.map(row=>row.id)).toContain(existing.id);
    const recycle=await archiveProjectForActor(actor,project.id,"Release fixture archive");
    expect((await listProjectsForActor(actor)).rows.map(row=>row.id)).not.toContain(project.id);
    expect((await client.project.findUniqueOrThrow({where:{id:project.id}})).archivedAt).not.toBeNull();
    expect(await client.project.count({where:{companyId}})).toBe(before+2);
    await expect(restoreMasterForActor({...actor,accountRole:"ACCOUNTANT"},recycle.id)).rejects.toThrow();
    await restoreMasterForActor(actor,recycle.id);
    expect((await listProjectsForActor(actor)).rows.map(row=>row.id)).toContain(project.id);
    expect((await client.project.findUniqueOrThrow({where:{id:project.id}})).name).toBe("Edited project");
    expect((await client.accountRecycleRecord.findUniqueOrThrow({where:{id:recycle.id}})).restoredAt).not.toBeNull();
    expect(await client.customer.count({where:{companyId}})).toBe(1);
    // Archive/restore provides no permanent deletion operation; original rows remain.
    expect(await client.project.count({where:{companyId}})).toBe(before+2);
  });
});
