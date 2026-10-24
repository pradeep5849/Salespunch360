import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
const url = process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_ci"))
)
  throw new Error("Isolated *_ci database required");
const client = new PrismaClient({
  datasources: {
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/checkpoint_ci" },
  },
});
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }),
}));
import {
  availableReportCatalogueForActor,
  unavailableReportCatalogueForActor,
  reportFavouritesForActor,
  setReportFavouriteForActor,
} from "./favourites";
const companyId = randomUUID(),
  otherCompany = randomUUID(),
  a = randomUUID(),
  b = randomUUID(),
  foreign = randomUUID();
beforeAll(async () => {
  if (!url) return;
  for (const id of [companyId, otherCompany])
    await client.company.create({
      data: {
        id,
        name: "Report favourite test",
        slug: `report-favourites-${id}`,
        productEdition: "SALESPUNCH360_ACCOUNT",
      },
    });
  for (const [id, tenant] of [
    [a, companyId],
    [b, companyId],
    [foreign, otherCompany],
  ])
    await client.user.create({
      data: {
        id,
        companyId: tenant,
        name: "Report user",
        email: `${id}@example.test`,
        passwordHash: "not-login-test",
        role: "ACCOUNT_USER",
        accountRole: "ACCOUNT_ADMIN",
        accountAccessActive: true,
      },
    });
});
afterAll(async () => {
  if (!url) return;
  await client.accountSettings.deleteMany({
    where: { companyId: { in: [companyId, otherCompany] } },
  });
  await client.user.deleteMany({
    where: { companyId: { in: [companyId, otherCompany] } },
  });
  await client.company.deleteMany({
    where: { id: { in: [companyId, otherCompany] } },
  });
  await client.$disconnect();
});
it.skipIf(!url)(
  "stores one favourite under concurrent retries and isolates users/companies",
  async () => {
    const actor = { id: a, companyId };
    await Promise.all(
      Array.from({ length: 6 }, () =>
        setReportFavouriteForActor(actor, {
          reportKey: "profit-loss",
          favourite: true,
        }),
      ),
    );
    expect(await reportFavouritesForActor(actor)).toEqual(["profit-loss"]);
    expect(
      await client.accountReportFavourite.count({
        where: { companyId, userId: a },
      }),
    ).toBe(1);
    expect(await reportFavouritesForActor({ id: b, companyId })).toEqual([]);
    expect(
      await reportFavouritesForActor({ id: foreign, companyId: otherCompany }),
    ).toEqual([]);
    await expect(
      setReportFavouriteForActor(
        { id: foreign, companyId },
        { reportKey: "profit-loss", favourite: true },
      ),
    ).rejects.toThrow();
    await expect(
      client.accountReportFavourite.create({
        data: { companyId, userId: foreign, reportKey: "tax" },
      }),
    ).rejects.toThrow();
    await setReportFavouriteForActor(actor, {
      reportKey: "profit-loss",
      favourite: false,
    });
    await setReportFavouriteForActor(actor, {
      reportKey: "profit-loss",
      favourite: false,
    });
    expect(await reportFavouritesForActor(actor)).toEqual([]);
  },
);
it.skipIf(!url)(
  "denies report permissions,unknown destinations and injected tenant fields",
  async () => {
    const actor = { id: b, companyId };
    await expect(
      setReportFavouriteForActor(actor, {
        reportKey: "../../settings",
        favourite: true,
      }),
    ).rejects.toThrow();
    await expect(
      setReportFavouriteForActor(actor, {
        reportKey: "tax",
        favourite: true,
        companyId: otherCompany,
      }),
    ).rejects.toThrow();
    await client.user.update({
      where: { id: b },
      data: { accountRole: "DATA_ENTRY" },
    });
    await expect(reportFavouritesForActor(actor)).rejects.toThrow();
    await expect(
      setReportFavouriteForActor(actor, { reportKey: "tax", favourite: true }),
    ).rejects.toThrow();
  },
);
it.skipIf(!url)(
  "limits Project Managers and hides disabled optional reports without deleting preferences",
  async () => {
    const actor = { id: a, companyId };
    await setReportFavouriteForActor(actor, {
      reportKey: "projects",
      favourite: true,
    });
    await client.user.update({
      where: { id: a },
      data: { accountRole: "PROJECT_MANAGER" },
    });
    expect(
      (await availableReportCatalogueForActor(actor)).map((x) => x.key),
    ).toEqual(["projects"]);
    await expect(
      setReportFavouriteForActor(actor, {
        reportKey: "profit-loss",
        favourite: true,
      }),
    ).rejects.toThrow();
    await client.accountSettings.create({
      data: { companyId, enabledModules: [] },
    });
    expect(await availableReportCatalogueForActor(actor)).toEqual([]);
    expect(await reportFavouritesForActor(actor)).toEqual([]);
    expect(
      await client.accountReportFavourite.count({
        where: { companyId, userId: a, reportKey: "projects" },
      }),
    ).toBe(1);
    await client.accountSettings.delete({ where: { companyId } });
  },
);
it.skipIf(!url)("keeps Purchase Register available under core accounting even when optional modules are empty",async()=>{
 const actor={id:a,companyId};await client.user.update({where:{id:a},data:{accountRole:"ACCOUNT_ADMIN"}});
 await client.accountSettings.upsert({where:{companyId},create:{companyId,enabledModules:["PURCHASES"]},update:{enabledModules:["PURCHASES"]}});
 expect((await availableReportCatalogueForActor(actor)).find(x=>x.key==="purchase-register")).toMatchObject({filters:["vendorId"]});await setReportFavouriteForActor(actor,{reportKey:"purchase-register",favourite:true});
 await client.accountSettings.update({where:{companyId},data:{enabledModules:[]}});expect((await availableReportCatalogueForActor(actor)).some(x=>x.key==="purchase-register")).toBe(true);expect(await reportFavouritesForActor(actor)).toContain("purchase-register");expect(await client.accountReportFavourite.count({where:{companyId,userId:a,reportKey:"purchase-register"}})).toBe(1);
});

it.skipIf(!url)("hides Project material report destinations when optional modules are disabled",async()=>{
 const actor={id:a,companyId};await client.user.update({where:{id:a},data:{accountRole:"ACCOUNT_ADMIN"}});await client.accountSettings.upsert({where:{companyId},create:{companyId,enabledModules:["PROJECTS","PROJECT_COSTING"]},update:{enabledModules:["PROJECTS","PROJECT_COSTING"]}});
 expect((await availableReportCatalogueForActor(actor)).map(x=>x.key)).toEqual(expect.arrayContaining(["material-consumption","project-transfer"]));
 await client.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS"]}});const noCost=(await availableReportCatalogueForActor(actor)).map(x=>x.key);expect(noCost).toContain("projects");expect(noCost).not.toContain("material-consumption");expect(noCost).not.toContain("project-transfer");
 await client.accountSettings.update({where:{companyId},data:{enabledModules:[]}});expect((await availableReportCatalogueForActor(actor)).map(x=>x.key)).not.toContain("projects");
});

it.skipIf(!url)("hides stock report destinations when Items is off without deleting favourites",async()=>{
 const actor={id:a,companyId};await client.user.update({where:{id:a},data:{accountRole:"ACCOUNT_ADMIN"}});
 await client.accountSettings.upsert({where:{companyId},create:{companyId,enabledModules:["INVENTORY"],itemSettings:{enabled:true}},update:{enabledModules:["INVENTORY"],itemSettings:{enabled:true}}});
 const keys=["stock-category","stock-detail","stock-summary","low-stock-summary","item-serial"];
 for(const reportKey of keys){expect((await availableReportCatalogueForActor(actor)).find(x=>x.key===reportKey)).toMatchObject({filters:reportKey==="item-serial"?["productId","itemSearch"]:reportKey==="stock-detail"||reportKey==="low-stock-summary"?["categoryId","itemStatus","itemSearch"]:reportKey==="stock-summary"?["categoryId","itemStatus","stockLevel","itemSearch"]:[]});await setReportFavouriteForActor(actor,{reportKey,favourite:true})}
 await client.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:false}}});
 const hidden=(await availableReportCatalogueForActor(actor)).map(x=>x.key),favourites=await reportFavouritesForActor(actor);
 for(const reportKey of keys){expect(hidden).not.toContain(reportKey);expect(favourites).not.toContain(reportKey);await expect(setReportFavouriteForActor(actor,{reportKey,favourite:true})).rejects.toThrow();expect(await client.accountReportFavourite.count({where:{companyId,userId:a,reportKey}})).toBe(1)}
 await client.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:true}}});expect(await reportFavouritesForActor(actor)).toEqual(expect.arrayContaining(keys));
});

it.skipIf(!url)("keeps party GST in core accounting and hides it from Project Managers",async()=>{
 await client.accountSettings.upsert({where:{companyId},create:{companyId,enabledModules:[]},update:{enabledModules:[]}});
 expect((await availableReportCatalogueForActor({id:a,companyId})).some(x=>x.key==="gst-party")).toBe(true);
 await client.user.update({where:{id:a},data:{accountRole:"PROJECT_MANAGER"}});
 try{expect((await availableReportCatalogueForActor({id:a,companyId})).some(x=>x.key==="gst-party")).toBe(false)}finally{await client.user.update({where:{id:a},data:{accountRole:"ACCOUNT_ADMIN"}})}
});

it.skipIf(!url)("keeps historical item discounts available when Items is off but enforces report role",async()=>{
 const actor={id:a,companyId};await client.user.update({where:{id:a},data:{accountRole:"ACCOUNT_ADMIN"}});await client.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:false}}});
 try{expect((await availableReportCatalogueForActor(actor)).find(x=>x.key==="item-discount")).toMatchObject({filters:["customerId","categoryId","itemSearch"]});await setReportFavouriteForActor(actor,{reportKey:"item-discount",favourite:true});expect(await reportFavouritesForActor(actor)).toContain("item-discount");await client.user.update({where:{id:a},data:{accountRole:"PROJECT_MANAGER"}});expect((await availableReportCatalogueForActor(actor)).some(x=>x.key==="item-discount")).toBe(false);await expect(setReportFavouriteForActor(actor,{reportKey:"item-discount",favourite:true})).rejects.toThrow()}finally{await client.user.update({where:{id:a},data:{accountRole:"ACCOUNT_ADMIN"}});await client.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:true}}})}
});

it.skipIf(!url)("A085 approved working reports preserve tenant role and stock-module guards",async()=>{
 const actor={id:a,companyId},before=await client.accountSettings.findUnique({where:{companyId}});
 try{
  await client.accountSettings.upsert({where:{companyId},create:{companyId,enabledModules:["INVENTORY"],itemSettings:{enabled:false}},update:{enabledModules:["INVENTORY"],itemSettings:{enabled:false}}});
  const hidden=await unavailableReportCatalogueForActor(actor);expect(hidden.some(row=>row.name==="Item Detail Report")).toBe(false);expect(hidden.some(row=>row.name==="GSTR-3B")).toBe(false);expect((await availableReportCatalogueForActor(actor)).find(row=>row.key==="gstr-3b")?.name).toBe("GSTR-3B Working Report");
  await client.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:true}}});expect((await availableReportCatalogueForActor(actor)).some(row=>row.key==="item-detail")).toBe(true);
  await expect(unavailableReportCatalogueForActor({id:foreign,companyId})).rejects.toThrow();await setReportFavouriteForActor(actor,{reportKey:"gstr-3b",favourite:true});expect(await reportFavouritesForActor(actor)).toContain("gstr-3b");await setReportFavouriteForActor(actor,{reportKey:"gstr-3b",favourite:false});await expect(setReportFavouriteForActor(actor,{reportKey:"not-a-report",favourite:true})).rejects.toThrow();
  await client.user.update({where:{id:a},data:{accountRole:"PROJECT_MANAGER"}});expect(await unavailableReportCatalogueForActor(actor)).toEqual([]);await expect(setReportFavouriteForActor(actor,{reportKey:"gstr-3b",favourite:true})).rejects.toThrow();
 }finally{await client.user.update({where:{id:a},data:{accountRole:"ACCOUNT_ADMIN"}});if(before)await client.accountSettings.update({where:{companyId},data:{enabledModules:before.enabledModules,itemSettings:before.itemSettings??{}}});else await client.accountSettings.deleteMany({where:{companyId}})}
});
