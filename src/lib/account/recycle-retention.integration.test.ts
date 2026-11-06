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
import { purgeExpiredRecycleRecords } from "./recycle-retention";
import { DEFAULT_LEDGER_ACCOUNTS } from "@/lib/accounting/default-accounts";
import {
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
describe.skipIf(!url)("seven-day recycle retention real database", () => {
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


  const now=new Date("2040-01-15T10:00:00Z"),old=new Date("2040-01-07T10:00:00Z"),activatedAt="2040-01-01T00:00:00Z";
  async function record(entityType:string,entityId:string,date=old) {
    return client.accountRecycleRecord.create({data:{companyId,entityType,entityId,displayName:"Fixture",archivedById:userId,archivedAt:date}});
  }
  it("purges every supported unlinked record type, retains links/files, excludes young/restored rows and retries safely",async()=>{
    const keeper=await client.customer.create({data:{companyId,branchId,name:"Linked customer",isAccountCustomer:true,isActive:false}});
    const customer=await client.customer.create({data:{companyId,branchId,name:"Unused customer",isAccountCustomer:true,isActive:false}});
    const vendor=await client.vendor.create({data:{companyId,name:"Unused vendor",isActive:false}});
    const product=await client.accountProduct.create({data:{companyId,name:"Unused product",isActive:false}});
    const photo=await client.accountProduct.create({data:{companyId,name:"Private photo",isActive:false,photoObjectKey:`companies/${companyId}/evidence.png`}});
    const project=await client.project.create({data:{companyId,branchId,customerId:keeper.id,createdById:userId,name:"Unused project",projectNumber:"PURGE",archivedAt:old}});
    const history=await client.project.create({data:{companyId,branchId,customerId:keeper.id,createdById:userId,name:"History project",projectNumber:"KEEP",archivedAt:old}});
    await client.projectAuditEvent.create({data:{companyId,projectId:history.id,actorUserId:userId,eventType:"PROJECT_CREATED"}});
    const young=await client.vendor.create({data:{companyId,name:"Young",isActive:false}});
    const restored=await client.vendor.create({data:{companyId,name:"Restored",isActive:true}});
    await record("CUSTOMER",keeper.id);const deleted=await record("CUSTOMER",customer.id);
    await record("VENDOR",vendor.id);await record("PRODUCT",product.id);await record("PRODUCT",photo.id);await record("PROJECT",project.id);await record("PROJECT",history.id);
    await record("VENDOR",young.id,new Date("2040-01-10T00:00:00Z"));
    const restoredRecord=await record("VENDOR",restored.id);await client.accountRecycleRecord.update({where:{id:restoredRecord.id},data:{restoredAt:now,restoredById:userId}});
    const result=await purgeExpiredRecycleRecords({now,activatedAt,limit:100});
    expect(result.failed).toBe(0);expect(result.purged).toBe(4);expect(result.retained).toBeGreaterThanOrEqual(3);
    expect(await client.customer.findUnique({where:{id:customer.id}})).toBeNull();
    expect(await client.project.findUnique({where:{id:project.id}})).toBeNull();
    expect(await client.project.findUnique({where:{id:history.id}})).not.toBeNull();
    expect(await client.vendor.findUnique({where:{id:young.id}})).not.toBeNull();
    expect(await client.vendor.findUnique({where:{id:restored.id}})).not.toBeNull();
    expect(await client.accountingAuditEvent.count({where:{companyId,eventType:"RECORD_PURGED"}})).toBe(4);
    await expect(restoreMasterForActor(actor,deleted.id)).rejects.toThrow("RECYCLE_RECORD_NOT_FOUND");
    expect((await purgeExpiredRecycleRecords({now,activatedAt,limit:100})).purged).toBe(0);
  });
  it("never follows a forged cross-company recycle reference",async()=>{
    const other=await client.company.create({data:{name:"Other tenant",slug:`retention-${randomUUID()}`,productEdition:"SALESPUNCH360_ACCOUNT"}});
    const otherBranch=await client.branch.create({data:{companyId:other.id,name:"Other branch",code:"OTHER"}});
    const customer=await client.customer.create({data:{companyId:other.id,branchId:otherBranch.id,name:"Other record",isActive:false}});
    const forged=await record("CUSTOMER",customer.id);
    await purgeExpiredRecycleRecords({now,activatedAt,limit:100});
    expect(await client.customer.findUnique({where:{id:customer.id}})).not.toBeNull();
    expect((await client.accountRecycleRecord.findUniqueOrThrow({where:{id:forged.id}})).purgedAt).toBeNull();
  });
  it("serializes restore against cleanup so a restored record is never deleted",async()=>{
    const vendor=await client.vendor.create({data:{companyId,name:"Restore race",isActive:false}});
    const row=await record("VENDOR",vendor.id);
    await Promise.allSettled([restoreMasterForActor(actor,row.id),purgeExpiredRecycleRecords({now,activatedAt,limit:100})]);
    const current=await client.accountRecycleRecord.findUniqueOrThrow({where:{id:row.id}});
    const saved=await client.vendor.findUnique({where:{id:vendor.id}});
    expect(Boolean(current.restoredAt) || Boolean(current.purgedAt)).toBe(true);
    if(current.restoredAt){expect(current.purgedAt).toBeNull();expect(saved?.isActive).toBe(true)}
    if(current.purgedAt){expect(current.restoredAt).toBeNull();expect(saved).toBeNull()}
  });

  it("retains product price history even when no foreign key exists",async()=>{
    const product=await client.accountProduct.create({data:{companyId,name:"Historical price",isActive:false}});
    await client.productPrice.create({data:{companyId,productId:product.id,priceType:"RETAIL",rate:"100"}});
    const row=await record("PRODUCT",product.id);
    await purgeExpiredRecycleRecords({now,activatedAt,limit:100});
    expect(await client.accountProduct.findUnique({where:{id:product.id}})).not.toBeNull();
    expect((await client.accountRecycleRecord.findUniqueOrThrow({where:{id:row.id}})).purgeBlockedReason).toBe("LINKED_BUSINESS_OR_AUDIT_HISTORY");
  });

});
