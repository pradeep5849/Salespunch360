import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermission,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import {
  categorySchema,
  currencySchema,
  customFieldSchema,
  financialYearSchema,
  itemSchema,
  numberingSeriesSchema,
  partySchema,
  unitSchema,
  workCategorySchema,
  workPackageSchema,
} from "./validation";
import { allocateDocumentNumberInTx } from "./numbering";

const readActor = () => requirePermission("ACCOUNT_DASHBOARD");
const writeActor = () => requirePermissionForMutation("ACCOUNT_ACCOUNTS");
const settingsActor = () => requirePermissionForMutation("ACCOUNT_SETTINGS");
export async function accountOverview() {
  const a = await readActor();
  return db.company.findUniqueOrThrow({
    where: { id: a.companyId! },
    select: {
      name: true,
      accountSettings: true,
      financialYears: { orderBy: { startDate: "desc" } },
      vendors: { orderBy: { name: "asc" } },
      accountUnits: { orderBy: { name: "asc" } },
      accountCategories: { orderBy: { name: "asc" } },
      accountProducts: {
        orderBy: { name: "asc" },
        include: { unit: true, category: true },
      },
      accountServices: {
        orderBy: { name: "asc" },
        include: { unit: true, category: true },
      },
      workCategories: { orderBy: { name: "asc" } },
      workPackages: {
        orderBy: { name: "asc" },
        include: { unit: true, workCategory: true },
      },
      customers: {
        where: { isAccountCustomer: true },
        orderBy: { name: "asc" },
      },
      customFieldDefinitions: {
        orderBy: [{ entityType: "asc" }, { position: "asc" }],
      },
    },
  });
}

const MASTER_PAGE_SIZE=50;
const masterKinds=new Set(["financial-years","customers","vendors","units","categories","products","services","work-categories","work-packages"]);
export async function accountMasterOverview(master:string,raw:{q?:string;page?:string|number}={}){
  if(!masterKinds.has(master))throw new Error("INVALID_MASTER_TYPE");
  const a=await readActor(),companyId=a.companyId!,q=(raw.q??"").trim().slice(0,100),parsedPage=Number(raw.page??1),page=Number.isFinite(parsedPage)&&parsedPage>0?Math.floor(parsedPage):1,skip=(page-1)*MASTER_PAGE_SIZE;
  const nameWhere=q?{name:{contains:q,mode:"insensitive" as const}}:{};
  const paged={skip,take:MASTER_PAGE_SIZE+1};
  const [accountSettings,financialYears,vendors,accountUnits,accountCategories,accountProducts,accountServices,workCategories,workPackages,customers]=await Promise.all([
    master==="financial-years"?db.accountSettings.findUnique({where:{companyId}}):Promise.resolve(null),
    master==="financial-years"?db.financialYear.findMany({where:{companyId,...nameWhere},orderBy:{startDate:"desc"},...paged}):Promise.resolve([]),
    master==="vendors"?db.vendor.findMany({where:{companyId,...nameWhere},orderBy:{name:"asc"},...paged}):Promise.resolve([]),
    master==="units"?db.accountUnit.findMany({where:{companyId,...nameWhere},orderBy:{name:"asc"},...paged}):(["products","services","work-packages"].includes(master)?db.accountUnit.findMany({where:{companyId,isActive:true},select:{id:true,name:true,symbol:true},orderBy:{name:"asc"},take:200}):Promise.resolve([])),
    master==="categories"?db.accountCategory.findMany({where:{companyId,...nameWhere},orderBy:{name:"asc"},...paged}):(["products","services"].includes(master)?db.accountCategory.findMany({where:{companyId,isActive:true},select:{id:true,name:true,scope:true},orderBy:{name:"asc"},take:200}):Promise.resolve([])),
    master==="products"?db.accountProduct.findMany({where:{companyId,...nameWhere},orderBy:{name:"asc"},include:{unit:true,category:true},...paged}):Promise.resolve([]),
    master==="services"?db.accountService.findMany({where:{companyId,...nameWhere},orderBy:{name:"asc"},include:{unit:true,category:true},...paged}):Promise.resolve([]),
    master==="work-categories"?db.workCategory.findMany({where:{companyId,...nameWhere},orderBy:{name:"asc"},...paged}):(master==="work-packages"?db.workCategory.findMany({where:{companyId,isActive:true},select:{id:true,name:true},orderBy:{name:"asc"},take:200}):Promise.resolve([])),
    master==="work-packages"?db.workPackage.findMany({where:{companyId,...nameWhere},orderBy:{name:"asc"},include:{unit:true,workCategory:true},...paged}):Promise.resolve([]),
    master==="customers"?db.customer.findMany({where:{companyId,isAccountCustomer:true,...nameWhere},orderBy:{name:"asc"},...paged}):Promise.resolve([]),
  ]);
  const primary=master==="customers"?customers:master==="vendors"?vendors:master==="units"?accountUnits:master==="categories"?accountCategories:master==="products"?accountProducts:master==="services"?accountServices:master==="work-categories"?workCategories:master==="work-packages"?workPackages:financialYears;
  const hasMore=primary.length>MASTER_PAGE_SIZE;
  return{accountSettings,financialYears:financialYears.slice(0,MASTER_PAGE_SIZE),vendors:vendors.slice(0,MASTER_PAGE_SIZE),accountUnits:master==="units"?accountUnits.slice(0,MASTER_PAGE_SIZE):accountUnits,accountCategories:master==="categories"?accountCategories.slice(0,MASTER_PAGE_SIZE):accountCategories,accountProducts:accountProducts.slice(0,MASTER_PAGE_SIZE),accountServices:accountServices.slice(0,MASTER_PAGE_SIZE),workCategories:master==="work-categories"?workCategories.slice(0,MASTER_PAGE_SIZE):workCategories,workPackages:workPackages.slice(0,MASTER_PAGE_SIZE),customers:customers.slice(0,MASTER_PAGE_SIZE),page,q,hasMore};
}
export async function setCurrency(raw: unknown) {
  const a = await settingsActor();
  const d = currencySchema.parse(raw);
  return db.accountSettings.upsert({
    where: { companyId: a.companyId! },
    create: { companyId: a.companyId!, ...d },
    update: d,
  });
}
export async function createFinancialYearForActor(
  a: { id: string; companyId: string },
  raw: unknown,
) {
  const d = financialYearSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "companies" WHERE "id"=${a.companyId!}::uuid FOR UPDATE`;
      const overlap = await tx.financialYear.findFirst({
        where: {
          companyId: a.companyId!,
          isActive: true,
          startDate: { lte: d.endDate },
          endDate: { gte: d.startDate },
        },
      });
      if (overlap) throw new Error("FINANCIAL_YEAR_OVERLAP");
      if (d.isCurrent)
        await tx.financialYear.updateMany({
          where: { companyId: a.companyId!, isCurrent: true },
          data: { isCurrent: false },
        });
      return tx.financialYear.create({
        data: { companyId: a.companyId!, ...d },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function createUnit(raw: unknown) {
  const a = await writeActor();
  return db.accountUnit.create({
    data: { companyId: a.companyId!, ...unitSchema.parse(raw) },
  });
}
export async function createCategory(raw: unknown) {
  const a = await writeActor();
  return db.accountCategory.create({
    data: { companyId: a.companyId!, ...categorySchema.parse(raw) },
  });
}

export async function updateUnit(id:string,raw:unknown){
  const a=await writeActor(),d=unitSchema.parse(raw);
  const row=await db.accountUnit.updateMany({where:{id,companyId:a.companyId!},data:d});
  if(row.count!==1)throw new AuthorizationError();
  return db.accountUnit.findFirstOrThrow({where:{id,companyId:a.companyId!}});
}
export async function setItemsActive(kind:"products"|"services",ids:string[],isActive:boolean){
  const a=await writeActor(),unique=[...new Set(ids)].filter(Boolean);
  if(!unique.length)return{count:0};
  return kind==="products"
    ?db.accountProduct.updateMany({where:{companyId:a.companyId!,id:{in:unique}},data:{isActive}})
    :db.accountService.updateMany({where:{companyId:a.companyId!,id:{in:unique}},data:{isActive}});
}
export async function saveUnitConversion(raw:{baseUnitId:string;secondaryUnitId:string;rate:string}){
  const a=await requirePermissionForMutation("ACCOUNT_STOCK");
  const rate=Number(raw.rate);
  if(!raw.baseUnitId||!raw.secondaryUnitId||raw.baseUnitId===raw.secondaryUnitId||!Number.isFinite(rate)||rate<=0)throw new Error("INVALID_UNIT_CONVERSION");
  const units=await db.accountUnit.count({where:{companyId:a.companyId!,id:{in:[raw.baseUnitId,raw.secondaryUnitId]},isActive:true}});
  if(units!==2)throw new Error("INVALID_UNIT");
  const settings=await db.accountSettings.findUnique({where:{companyId:a.companyId!},select:{itemSettings:true}});
  const current=(settings?.itemSettings??{}) as Record<string,unknown>;
  const conversions=Array.isArray(current.unitConversions)?current.unitConversions.filter((x):x is Record<string,unknown>=>Boolean(x)&&typeof x==="object"):[];
  const next=[...conversions.filter(x=>!(x.baseUnitId===raw.baseUnitId&&x.secondaryUnitId===raw.secondaryUnitId)),{baseUnitId:raw.baseUnitId,secondaryUnitId:raw.secondaryUnitId,rate}];
  const itemSettings={...current,unitConversions:next} as Prisma.InputJsonObject;
  return db.accountSettings.upsert({where:{companyId:a.companyId!},create:{companyId:a.companyId!,itemSettings},update:{itemSettings}});
}
export async function createVendor(raw: unknown) {
  const a = await writeActor(),
    d = partySchema.parse(raw);
  return db.vendor.create({
    data: {
      companyId: a.companyId!,
      name: d.name,
      contactPerson: d.contactPerson,
      phone: d.phone,
      email: d.email,
      address: d.address,
      gstin: d.gstin,
      stateCode: d.stateCode,
      gstRegistrationType: d.gstRegistrationType,
      pan: d.pan,
      notes: d.notes,
    },
  });
}
export async function createAccountCustomer(raw: unknown) {
  const a = await writeActor();
  const d = partySchema.parse(raw);
  const branch = await db.branch.findFirst({
    where: { companyId: a.companyId!, isPrimary: true, isActive: true },
    select: { id: true },
  });
  if (!branch) throw new Error("PRIMARY_BRANCH_REQUIRED");
  return db.customer.create({
    data: {
      companyId: a.companyId!,
      branchId: branch.id,
      isAccountCustomer: true,
      name: d.name,
      contactPerson: d.contactPerson,
      phone: d.phone,
      email: d.email,
      address: d.address,
      billingAddress: d.address,
      shippingAddress: d.shippingAddress,
      gstin: d.gstin,
      stateCode: d.stateCode,
      gstRegistrationType: d.gstRegistrationType,
      pan: d.pan,
      notes: d.notes,
    },
  });
}
export async function createAccountCustomerForBranch(branchId:string,raw:unknown){
  const a=await writeActor(),d=partySchema.parse(raw),branch=await db.branch.findFirst({where:{id:branchId,companyId:a.companyId!,isActive:true,...(a.branchAccessScope==="SELECTED_BRANCHES"?{id:{in:a.branchIds??[]}}:{})},select:{id:true}});
  if(!branch)throw new AuthorizationError();
  return db.customer.create({data:{companyId:a.companyId!,branchId:branch.id,isAccountCustomer:true,name:d.name,contactPerson:d.contactPerson,phone:d.phone,email:d.email,address:d.address,billingAddress:d.address,shippingAddress:d.shippingAddress,gstin:d.gstin,stateCode:d.stateCode,gstRegistrationType:d.gstRegistrationType,pan:d.pan,notes:d.notes}});
}
async function refs(
  companyId: string,
  d: { unitId?: string; categoryId?: string },
  kind: "PRODUCT" | "SERVICE",
) {
  if (
    d.unitId &&
    !(await db.accountUnit.findFirst({
      where: { id: d.unitId, companyId, isActive: true },
    }))
  )
    throw new Error("INVALID_UNIT");
  if (
    d.categoryId &&
    !(await db.accountCategory.findFirst({
      where: {
        id: d.categoryId,
        companyId,
        isActive: true,
        scope: { in: [kind, "BOTH"] },
      },
    }))
  )
    throw new Error("INVALID_CATEGORY");
}
export async function createProduct(raw: unknown) {
  const a = await writeActor(),
    d = itemSchema.parse(raw);
  await refs(a.companyId!, d, "PRODUCT");
  return db.accountProduct.create({
    data: {
      companyId: a.companyId!,
      name: d.name,
      code: d.code,
      categoryId: d.categoryId,
      unitId: d.unitId,
      description: d.description,
      salePrice: d.sellingRate,
      costPrice: d.cost,
      taxRate: d.taxRate,
      hsnCode: d.hsnSacCode,
      barcode: d.barcode,
      trackInventory: d.trackInventory,
      trackingMode: d.trackInventory ? d.trackingMode : "NONE",
      lowStockThreshold: d.lowStockThreshold,
    },
  });
}
export async function createService(raw: unknown) {
  const a = await writeActor(),
    d = itemSchema.parse(raw);
  await refs(a.companyId!, d, "SERVICE");
  return db.accountService.create({
    data: {
      companyId: a.companyId!,
      name: d.name,
      code: d.code,
      categoryId: d.categoryId,
      unitId: d.unitId,
      description: d.description,
      sellingRate: d.sellingRate,
      estimatedCost: d.cost,
      taxRate: d.taxRate,
      sacCode: d.hsnSacCode,
    },
  });
}
export async function createWorkCategory(raw: unknown) {
  const a = await writeActor();
  return db.workCategory.create({
    data: { companyId: a.companyId!, ...workCategorySchema.parse(raw) },
  });
}
export async function createWorkPackage(raw: unknown) {
  const a = await writeActor(),
    d = workPackageSchema.parse(raw);
  if (
    d.unitId &&
    !(await db.accountUnit.findFirst({
      where: { id: d.unitId, companyId: a.companyId!, isActive: true },
    }))
  )
    throw new Error("INVALID_UNIT");
  if (
    !(await db.workCategory.findFirst({
      where: { id: d.workCategoryId, companyId: a.companyId!, isActive: true },
    }))
  )
    throw new Error("INVALID_WORK_CATEGORY");
  return db.workPackage.create({
    data: {
      companyId: a.companyId!,
      name: d.name,
      code: d.code,
      workCategoryId: d.workCategoryId,
      unitId: d.unitId,
      description: d.description,
      sellingRate: d.sellingRate,
      estimatedCost: d.cost,
    },
  });
}
export async function createCustomField(raw: unknown) {
  const a = await settingsActor(),
    d = customFieldSchema.parse(raw);
  return db.customFieldDefinition.create({
    data: {
      companyId: a.companyId!,
      ...d,
      options: d.options ?? Prisma.JsonNull,
    },
  });
}
export async function createNumberingSeries(raw: unknown) {
  const a = await settingsActor(),
    d = numberingSeriesSchema.parse(raw);
  if (
    d.branchId &&
    a.branchAccessScope === "SELECTED_BRANCHES" &&
    !(a.branchIds ?? []).includes(d.branchId)
  )
    throw new Error("INVALID_BRANCH");
  if (
    d.branchId &&
    !(await db.branch.findFirst({
      where: { id: d.branchId, companyId: a.companyId!, isActive: true },
    }))
  )
    throw new Error("INVALID_BRANCH");
  return db.numberingSeries.create({ data: { companyId: a.companyId!, ...d } });
}
/** Atomically reserves one number. Tenant and branch scope always come from the session. */
export async function allocateDocumentNumber(
  seriesId: string,
  branchId?: string,
) {
  const a = await writeActor();
  if (
    branchId &&
    a.branchAccessScope === "SELECTED_BRANCHES" &&
    !(a.branchIds ?? []).includes(branchId)
  )
    throw new Error("INVALID_BRANCH");
  return db.$transaction(
    (tx) =>
      allocateDocumentNumberInTx(tx, {
        companyId: a.companyId!,
        branchId,
        seriesId,
      }),
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

export async function createFinancialYear(raw: unknown) {
  const a = await settingsActor();
  return createFinancialYearForActor({ ...a, companyId: a.companyId! }, raw);
}
