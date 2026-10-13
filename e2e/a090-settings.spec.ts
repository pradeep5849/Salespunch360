import AxeBuilder from "@axe-core/playwright";
import {mobileStockSummary,mobileStockSummaryExport} from "../src/lib/mobile/account-inventory";
import {reversePostedSaleForActor} from "../src/lib/account/sale-amendments";
import {setupOwnerFinancialAccountForActor,postOwnerTransactionForActor} from "../src/lib/account/money";
import {runFinancialReportForActor} from "../src/lib/account/reports/service";
import {reverseJournalForActor} from "../src/lib/accounting/service";
import {createQuotationForActor,createQuotationRevisionForActor,transitionQuotationForActor,createQuotationShareForActor,getPublicQuotation,getQuotationForActor} from "../src/lib/quotations/service";
import {mobileSaveAsset,mobileAssetDetail} from "../src/lib/mobile/account-accounting";
import {mobileCreateProject,mobileProjectOptions,mobileUpdateProject} from "../src/lib/mobile/account-projects";
import {createSimpleProjectForActor} from "../src/lib/account/project-simple-workflow";
import {updateProjectForActor,projectDashboardForActor,type ProjectActor} from "../src/lib/account/projects";
import {saveMobileAccountMaster,saveMobileUnitConversion,listMobileAccountMaster} from "../src/lib/mobile/account-master-data";
import {createStockMovementForActor} from "../src/lib/account/inventory";
import {mobileCreateSales,mobileReplaceSale,mobileDeleteSale} from "../src/lib/mobile/account-transactions";
import {createAccountBackupForActor} from "../src/lib/account/utilities";
import {privateStorage} from "../src/lib/storage";
import {dueServiceReminders,completeServiceReminder} from "../src/lib/account/service-reminders";
import {PRINT_BOOLS} from "../src/lib/account/invoice-print-settings";
import {TRANSACTION_TOGGLES} from "../src/lib/account/transaction-settings";
import {recentSalePrices} from "../src/lib/account/recent-sale-prices";
import {DEFAULT_LEDGER_ACCOUNTS} from "../src/lib/accounting/default-accounts";
import {createSettlementForActor,postCommercialDocumentForActor,documentOutstandingInTx,applyAdvanceForActor} from "../src/lib/account/commercial";
import {createCommercialDocumentForActor} from "../src/lib/account/commercial";
import {invoiceShareUrl} from "../src/lib/account/invoice-share";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
import {createSessionToken,hashSessionToken} from "../src/lib/auth/crypto";
import { createHash,randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { postJournalInTx } from "../src/lib/accounting/service";
import { expect, test, type Page, type BrowserContext } from "@playwright/test";
let settingsCookies:Awaited<ReturnType<BrowserContext["cookies"]>>=[];
async function signInSettings(page:Page){
 if(settingsCookies.length){await page.context().addCookies(settingsCookies);await page.goto("/workspace/account");await expect(page).toHaveURL(/\/workspace\/account/);return}
 await page.goto("/sign-in");await page.getByLabel("Email",{exact:true}).fill(email);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign In",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/account/);
 settingsCookies=await page.context().cookies();
}

const db = new PrismaClient(),
  companyId = randomUUID(),
  branchId = randomUUID(),
  userId = randomUUID(),
  assetId = randomUUID(),
  customerId=randomUUID(),printDocumentId=randomUUID(),productId=randomUUID(),
  otherCompanyId = randomUUID(),
  password = "Asset-browser-fixture-934!",
  email = `${userId}@example.test`;
test.beforeAll(async () => {
  settingsCookies=[];
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !url.pathname.endsWith("_ci")
  )
    throw new Error("Browser tests require isolated local *_ci database");
  await db.company.create({
    data: {
      id: companyId,
      name: "Settings browser fixture",
      slug: `settings-browser-${companyId}`,
      productEdition: "SALESPUNCH360_ACCOUNT",
      subscriptionStatus: "TRIAL",
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  await db.accountSettings.create({
    data: { companyId, enabledModules: ["ASSETS"] },
  });
  await db.branch.create({
    data: {
      id: branchId,
      companyId,
      name: "Asset branch",
      code: "PRIMARY",
      isPrimary: true,
    },
  });
  await db.user.create({
    data: {
      id: userId,
      companyId,
      name: "Asset administrator",
      email,
      passwordHash: await hash(password),
      role: "COMPANY_ADMIN",
      accountRole: "ACCOUNT_ADMIN",
      salesRole: "PRIMARY_ADMIN",
      accountAccessActive: true,
      emailVerifiedAt: new Date(),
    },
  });
  await db.asset.create({data:{id:assetId,companyId,branchId,assetNumber:"A090-001",name:"Settings verification equipment",assetType:"EQUIPMENT",purchaseDate:new Date("2026-10-11"),purchaseValue:"12.35",salvageValue:"1.20",createdById:userId}});
  await db.customer.create({data:{id:customerId,companyId,branchId,name:"Print fixture customer",isAccountCustomer:true}});
  await db.accountProduct.create({data:{id:productId,companyId,name:"Reminder verification item"}});
  await db.commercialDocument.create({data:{id:printDocumentId,companyId,branchId,type:"SALES_INVOICE",status:"DRAFT",documentNumber:"PRINT-97",customerId,partyId:customerId,partyName:"Print fixture customer",issueDate:new Date("2026-10-11"),subtotal:"100",taxableTotal:"100",taxTotal:"18",cgstTotal:"9",sgstTotal:"9",grandTotal:"118",balanceDue:"118",createdById:userId}});
  await db.company.create({data:{id:otherCompanyId,name:"Other settings tenant",slug:`other-settings-${otherCompanyId}`,productEdition:"SALESPUNCH360_ACCOUNT"}});
  await db.accountSettings.create({data:{companyId:otherCompanyId,baseCurrency:"INR",displayDecimalPlaces:2,dateFormat:"DD/MM/YYYY"}});
});
test.afterAll(async () => {
  await db.mobileSession.deleteMany({ where: { userId } });
  await db.assetAssignmentHistory.deleteMany({ where: { companyId } });
  await db.asset.deleteMany({ where: { companyId } });
  await db.accountOperationalAudit.deleteMany({ where: { companyId } });
  await db.numberingSeries.deleteMany({ where: { companyId } });
  await db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
    // Only the localhost *_ci fixture tenant is removed. Production material guards remain unchanged.
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    await tx.projectMaterialMovement.deleteMany({where:{companyId}});
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = origin");
    await tx.stockMovement.deleteMany({where:{companyId}});
    await tx.paymentReminder.deleteMany({where:{companyId}});
    await tx.commercialAuditEvent.deleteMany({where:{companyId}});
    await tx.settlementAllocation.deleteMany({where:{companyId}});
    await tx.advanceApplication.deleteMany({where:{companyId}});
    await tx.accountSettlement.deleteMany({where:{companyId}});
    await tx.purchaseLineAllocation.deleteMany({where:{companyId}});
    await tx.commercialDocumentLine.deleteMany({where:{companyId}});
    await tx.commercialDocument.deleteMany({where:{companyId}});
    await tx.ownerTransaction.deleteMany({where:{companyId}});
    await tx.journalLine.deleteMany({where:{companyId}});
    await tx.journalEntry.deleteMany({where:{companyId}});
    await tx.accountingAuditEvent.deleteMany({where:{companyId}});
  });
  await db.projectAuditEvent.deleteMany({where:{companyId}});
  await db.projectMember.deleteMany({where:{companyId}});
  await db.project.deleteMany({where:{companyId}});
  await db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
  await tx.quotationShare.deleteMany({where:{companyId}});
  await tx.quotationAuditEvent.deleteMany({where:{companyId}});
  await tx.quotationPaymentSchedule.deleteMany({where:{companyId}});
  await tx.quotationAdjustment.deleteMany({where:{companyId}});
  await tx.quotationLine.deleteMany({where:{companyId}});
  await tx.quotationRevision.deleteMany({where:{companyId}});
  await tx.quotationDocument.deleteMany({where:{companyId}});
  });
  await db.customer.deleteMany({where:{companyId}});
  await db.vendor.deleteMany({where:{companyId}});
  await db.inventorySerialNumber.deleteMany({where:{companyId}});
  await db.inventoryBatch.deleteMany({where:{companyId}});
  await db.warehouse.deleteMany({where:{companyId}});
  await db.accountProduct.deleteMany({where:{companyId}});
  await db.accountService.deleteMany({where:{companyId}});
  await db.accountUnit.deleteMany({where:{companyId}});
  await db.customFieldValue.deleteMany({where:{companyId}});
  await db.customFieldDefinition.deleteMany({where:{companyId}});
  await db.ownerFinancialAccount.deleteMany({where:{companyId}});
  await db.moneyAccount.deleteMany({where:{companyId}});
  await db.ledgerAccount.deleteMany({where:{companyId}});
  await db.financialYear.deleteMany({where:{companyId}});
  await db.accountBackupRecord.deleteMany({where:{companyId}});
  await db.accountSettings.deleteMany({ where: { companyId } });
  await db.accountSettings.deleteMany({where:{companyId:otherCompanyId}});
  await db.company.deleteMany({where:{id:otherCompanyId}});
  await db.user.deleteMany({ where: { companyId } });
  await db.branch.deleteMany({ where: { companyId } });
  await db.company.deleteMany({ where: { id: companyId } });
  await db.$disconnect();
});

test("A090 saves company preferences, survives reload, formats data and protects unsaved navigation", async ({page}) => {
  test.setTimeout(120_000);
  await page.goto("/sign-in");
  await page.getByLabel("Email",{exact:true}).fill(email);
  await page.getByLabel("Password",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Sign In",exact:true}).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto(`/workspace/account/assets/${assetId}`);
  await page.goto("/workspace/account/settings/general");
  await page.getByLabel("Business Currency",{exact:true}).selectOption("USD");
  await page.getByRole("button",{name:"Increase decimal places"}).click();
  await page.getByLabel("Date Format",{exact:true}).selectOption("YYYY-MM-DD");
  await page.getByRole("button",{name:"Save General Settings",exact:true}).click();
  await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();
  await expect(page.getByText("Unsaved changes",{exact:true})).toHaveCount(0);
  const saved=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
  expect(saved.baseCurrency).toBe("USD");
  expect(saved.displayDecimalPlaces).toBe(3);
  expect(saved.dateFormat).toBe("YYYY-MM-DD");
  expect(await db.accountingAuditEvent.count({where:{companyId,eventType:"SETTINGS_CHANGED"}})).toBe(1);
  const other=await db.accountSettings.findUniqueOrThrow({where:{companyId:otherCompanyId}});
  expect([other.baseCurrency,other.displayDecimalPlaces,other.dateFormat]).toEqual(["INR",2,"DD/MM/YYYY"]);
  await page.reload();
  await expect(page.getByLabel("Business Currency",{exact:true})).toHaveValue("USD");
  await expect(page.locator("output")).toHaveText("3");
  await expect(page.getByLabel("Date Format",{exact:true})).toHaveValue("YYYY-MM-DD");
  await page.goto(`/workspace/account/assets/${assetId}`);
  await expect(page.locator(".account-money").filter({hasText:"$12.350"})).toBeVisible();
  await expect(page.getByText("2026-10-11",{exact:true})).toBeVisible();
  await page.goto("/workspace/account/settings/general");
  await page.getByRole("button",{name:"Increase decimal places"}).click();
  const linkWarning=new Promise<void>(resolve=>page.once("dialog",async dialog=>{expect(dialog.message()).toContain("without saving");await dialog.dismiss();resolve()}));
  await page.locator('a[href="/workspace/account/settings/backup"]').click();
  await linkWarning;
  await expect(page).toHaveURL(/settings\/general$/);
  const backWarning=new Promise<void>(resolve=>page.once("dialog",async dialog=>{expect(["confirm","beforeunload"]).toContain(dialog.type());if(dialog.type()==="confirm")expect(dialog.message()).toContain("without saving");await dialog.dismiss();resolve()}));
  await page.evaluate(()=>history.back());
  await backWarning;
  await expect(page).toHaveURL(/settings\/general$/);
  await expect(page.locator("output")).toHaveText("4");
  await page.getByLabel("Show warning for unsaved changes",{exact:true}).uncheck();
  await page.getByRole("button",{name:"Save General Settings",exact:true}).click();
  await expect(page.getByText("Unsaved changes",{exact:true})).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Show warning for unsaved changes",{exact:true})).not.toBeChecked();
});

test("A091 saves module choices, keeps other preferences and refreshes available destinations",async({page})=>{
  test.setTimeout(120_000);
  await page.goto("/sign-in");
  await page.getByLabel("Email",{exact:true}).fill(email);
  await page.getByLabel("Password",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Sign In",exact:true}).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  const before=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
  await page.goto("/workspace/account/settings/modules");
  await page.getByLabel("Business Type",{exact:true}).selectOption("INTERIOR_CONSTRUCTION");
  await expect(page.locator("label").filter({has:page.getByRole("checkbox",{name:/Projects/})})).toContainText("Recommended");
  await page.getByRole("checkbox",{name:/Projects/}).check();
  await page.getByRole("checkbox",{name:/Fixed Assets/}).uncheck();
  await page.getByRole("button",{name:"Save setup",exact:true}).click();
  await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();
  const saved=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
  expect(saved.businessType).toBe("INTERIOR_CONSTRUCTION");
  expect(saved.enabledModules).toEqual(expect.arrayContaining(["PROJECTS","PROJECT_COSTING","SALES","INVENTORY"]));
  expect(saved.enabledModules).not.toContain("ASSETS");
  expect([saved.baseCurrency,saved.displayDecimalPlaces,saved.dateFormat]).toEqual([before.baseCurrency,before.displayDecimalPlaces,before.dateFormat]);
  await page.reload();
  await expect(page.getByLabel("Business Type",{exact:true})).toHaveValue("INTERIOR_CONSTRUCTION");
  await expect(page.getByRole("checkbox",{name:/Projects/})).toBeChecked();
  await expect(page.getByRole("checkbox",{name:/Fixed Assets/})).not.toBeChecked();
  await page.goto("/workspace/account/menu");
  await expect(page.locator('a[href="/workspace/account/projects"]').first()).toBeVisible();
  await expect(page.locator('a[href="/workspace/account/assets"]')).toHaveCount(0);
  await page.goto("/workspace/account/settings/modules");
  await page.getByRole("checkbox",{name:/Projects/}).uncheck();
  await page.getByRole("checkbox",{name:/Fixed Assets/}).check();
  await page.getByRole("button",{name:"Save setup",exact:true}).click();
  await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();
  const final=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
  expect(final.enabledModules).toContain("ASSETS");
  expect(final.enabledModules).not.toContain("PROJECTS");
  expect(final.enabledModules).not.toContain("PROJECT_COSTING");
  const audits=await db.accountingAuditEvent.findMany({where:{companyId,eventType:"SETTINGS_CHANGED"}});
  expect(audits.filter(a=>JSON.stringify(a.metadata).includes('"MODULES"'))).toHaveLength(2);
});

test("A092 branch creation, duplicate recovery, edit landing and deactivation protections work",async({page})=>{
  test.setTimeout(120_000);
  await page.goto("/sign-in");
  await page.getByLabel("Email",{exact:true}).fill(email);
  await page.getByLabel("Password",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Sign In",exact:true}).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/settings/multi-branch");
  await page.getByRole("link",{name:"+ Add Branch",exact:true}).click();
  await expect(page).toHaveURL(/branches\?from=account-settings#add-branch/);
  const create=page.locator("#add-branch");
  await create.getByLabel("Name",{exact:true}).fill("Settings new branch");
  await create.getByLabel("Code",{exact:true}).fill("PRIMARY");
  await create.getByRole("button",{name:"Create Branch",exact:true}).click();
  await expect(create.getByRole("alert")).toContainText("already in use");
  await expect(create.getByLabel("Name",{exact:true})).toHaveValue("Settings new branch");
  await expect(create.getByLabel("Code",{exact:true})).toHaveValue("PRIMARY");
  await create.getByLabel("Code",{exact:true}).fill("a092");
  await create.getByRole("button",{name:"Create Branch",exact:true}).click();
  await expect(create.getByText("Saved successfully",{exact:true})).toBeVisible();
  const added=await db.branch.findFirstOrThrow({where:{companyId,code:"A092"}});
  expect(added.isPrimary).toBe(false);
  expect(await db.branch.count({where:{companyId,code:"A092"}})).toBe(1);
  await page.goto("/workspace/account/settings/multi-branch");
  await page.getByRole("link",{name:/Settings new branch/}).click();
  const card=page.locator(`#branch-${added.id}`);
  await expect(card.locator("details")).toHaveAttribute("open","");
  await card.getByLabel("Name",{exact:true}).fill("Settings renamed branch");
  await card.getByRole("button",{name:"Save",exact:true}).click();
  await expect(card.getByText("Saved successfully",{exact:true})).toBeVisible();
  expect((await db.branch.findUniqueOrThrow({where:{id:added.id}})).name).toBe("Settings renamed branch");
  await card.getByRole("button",{name:"Deactivate",exact:true}).click();
  await expect(card.getByRole("button",{name:"Activate",exact:true})).toBeVisible();
  expect((await db.branch.findUniqueOrThrow({where:{id:added.id}})).isActive).toBe(false);
  await card.getByRole("button",{name:"Activate",exact:true}).click();
  await expect(card.getByRole("button",{name:"Deactivate",exact:true})).toBeVisible();
  await db.asset.create({data:{companyId,branchId:added.id,assetNumber:"A092-USED",name:"Used branch equipment",assetType:"EQUIPMENT",purchaseDate:new Date("2026-10-11"),purchaseValue:"10",createdById:userId}});
  await card.getByRole("button",{name:"Deactivate",exact:true}).click();
  await expect(card.getByRole("alert")).toContainText("cannot be deactivated");
  expect((await db.branch.findUniqueOrThrow({where:{id:added.id}})).isActive).toBe(true);
  await expect(page.locator(`#branch-${branchId}`).getByRole("button",{name:"Deactivate",exact:true})).toHaveCount(0);
});


test("A093 saves business currency and explains why a posted ledger cannot be relabelled",async({page})=>{
 test.setTimeout(120_000);
 await page.goto("/sign-in");
 await page.getByLabel("Email",{exact:true}).fill(email);
 await page.getByLabel("Password",{exact:true}).fill(password);
 await page.getByRole("button",{name:"Sign In",exact:true}).click();
 await expect(page).toHaveURL(/\/workspace\/account/);
 await page.goto("/workspace/account/settings/multi-currency");
 await page.getByLabel("Business Currency",{exact:true}).selectOption("AED");
 await page.getByRole("button",{name:"Save",exact:true}).click();
 await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByLabel("Business Currency",{exact:true})).toHaveValue("AED");
 const year=await db.financialYear.create({data:{companyId,name:"Currency verification",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
 const cash=await db.ledgerAccount.create({data:{companyId,code:"CASH",name:"Currency verification cash",accountClass:"ASSET",normalBalance:"DEBIT"}});
 const income=await db.ledgerAccount.create({data:{companyId,code:"INCOME",name:"Currency verification income",accountClass:"INCOME",normalBalance:"CREDIT"}});
 await db.$transaction(tx=>postJournalInTx(tx,{id:userId,companyId,branchAccessScope:"ALL_BRANCHES"},{financialYearId:year.id,branchId,entryDate:"2026-10-11",sourceType:"MANUAL_JOURNAL",sourceId:randomUUID(),lines:[{ledgerAccountId:cash.id,debit:"10",credit:"0"},{ledgerAccountId:income.id,debit:"0",credit:"10"}]}));
 await page.getByLabel("Business Currency",{exact:true}).selectOption("USD");
 await page.getByRole("button",{name:"Save",exact:true}).click();
 await expect(page.getByText("Business currency cannot be changed after accounting entries have been posted.",{exact:true})).toBeVisible();
 await expect(page.getByLabel("Business Currency",{exact:true})).toHaveValue("USD");
 expect((await db.accountSettings.findUniqueOrThrow({where:{companyId}})).baseCurrency).toBe("AED");
 await page.reload();
 await expect(page.getByLabel("Business Currency",{exact:true})).toHaveValue("AED");
 await page.goto("/workspace/account/settings/general");
 await page.getByLabel("Business Currency",{exact:true}).selectOption("EUR");
 await page.getByRole("button",{name:"Save General Settings",exact:true}).click();
 await expect(page.getByText("Business currency cannot be changed after accounting entries have been posted.",{exact:true})).toBeVisible();
 await page.getByLabel("Business Currency",{exact:true}).selectOption("AED");
 await page.getByRole("button",{name:"Decrease decimal places"}).click();
 await page.getByRole("button",{name:"Save General Settings",exact:true}).click();
 await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();
});


test("A094 Settings menu searches and opens each listed destination",async({page})=>{
 test.setTimeout(180_000);
 await signInSettings(page);
 await page.goto("/workspace/account/settings");
 await page.getByRole("button",{name:"Search settings",exact:true}).click();
 await page.getByRole("textbox",{name:"Search settings",exact:true}).fill("unmatched-settings");
 await expect(page.getByText("No settings found.")).toBeVisible();
 await page.getByRole("textbox",{name:"Search settings",exact:true}).fill("currency");
 await expect(page.getByRole("navigation",{name:"Account settings",exact:true}).getByRole("link")).toHaveCount(1);
 await page.getByRole("button",{name:"Close settings search",exact:true}).click();
 const links=await page.getByRole("navigation",{name:"Account settings",exact:true}).getByRole("link").evaluateAll(els=>els.map(el=>({label:el.getAttribute("aria-label")!,href:el.getAttribute("href")!})));
 expect(links).toHaveLength(10);
 for(const link of links){await page.getByRole("link",{name:link.label,exact:true}).click();await expect(page).toHaveURL(new RegExp(link.href+"$"));await expect(page.getByText("This page could not be found.",{exact:true})).toHaveCount(0);await expect(page.getByRole("heading").first()).toBeVisible();await page.goto("/workspace/account/settings");}
});

test("A095 and A096 preserve party field metadata and apply party settings to party creation",async({page})=>{
 test.setTimeout(120_000);
 await signInSettings(page);
 await page.goto("/workspace/account/settings/party/additional-fields");
 const slot=page.getByRole("group",{name:"Additional Field 1",exact:true});
 await slot.getByRole("checkbox",{name:"Enable field"}).check();
 await slot.getByRole("textbox",{name:"Field Name",exact:true}).fill("Site reference");
 await slot.getByRole("checkbox",{name:"Show in print"}).check();
 await slot.getByRole("checkbox",{name:"Enable field"}).uncheck();
 await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();
 await page.reload();
 await expect(slot.getByRole("textbox",{name:"Field Name",exact:true})).toHaveValue("Site reference");
 await expect(slot.getByRole("checkbox",{name:"Show in print"})).toBeChecked();
 await slot.getByRole("checkbox",{name:"Enable field"}).check();await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();
 const fields=await db.customFieldDefinition.findMany({where:{companyId,fieldKey:"party_additional_1"}});expect(fields).toHaveLength(2);expect(fields.every(x=>x.isActive&&x.label==="Site reference")).toBe(true);
 const dateSlot=page.getByRole("group",{name:"Date Field",exact:true});await dateSlot.getByRole("checkbox",{name:"Enable field"}).check();await dateSlot.getByRole("textbox",{name:"Field Name",exact:true}).fill("Service anniversary");await dateSlot.getByRole("checkbox",{name:"Show in print"}).check();await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();
 const dateDefinition=await db.customFieldDefinition.findFirstOrThrow({where:{companyId,entityType:"CUSTOMER",fieldKey:"party_date"}});await db.customFieldValue.create({data:{companyId,definitionId:dateDefinition.id,entityType:"CUSTOMER",entityId:customerId,value:"2026-10-09"}});const printedDate=await page.request.get(`/api/account/print/SALES_INVOICE/${printDocumentId}`);expect(printedDate.status()).toBe(200);expect(await printedDate.text()).toContain("Service anniversary");expect(await printedDate.text()).toContain("09/10/2026");
 await page.goto("/workspace/account/settings/party");
 await page.getByRole("checkbox",{name:"Print Shipping Address",exact:true}).check();
 await page.getByRole("checkbox",{name:"GSTIN Number",exact:true}).uncheck();await page.getByRole("checkbox",{name:"Party Grouping",exact:true}).check();await page.getByRole("checkbox",{name:"Party Shipping Address",exact:true}).uncheck();await expect(page.getByRole("checkbox",{name:"Print Shipping Address",exact:true})).toBeDisabled();
 await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole("checkbox",{name:"GSTIN Number",exact:true})).not.toBeChecked();await expect(page.getByRole("checkbox",{name:"Party Grouping",exact:true})).toBeChecked();
 await expect(page.getByRole("checkbox",{name:"Print Shipping Address",exact:true})).toBeChecked();expect((await db.accountSettings.findUniqueOrThrow({where:{companyId}})).transactionDefaults).toMatchObject({partySettings:{shippingAddressEnabled:false,printShippingAddress:true}});
 await page.goto("/workspace/account/customers");
 await expect(page.getByLabel("GSTIN / TIN / VATIN",{exact:true})).toHaveCount(0);
 await expect(page.getByLabel("Shipping / site address",{exact:true})).toHaveCount(0);
 await expect(page.getByLabel("Site reference",{exact:true})).toBeVisible();
});


test("A097 through A103 settings save, reload and retain neighbouring sections",async({page})=>{
 test.setTimeout(180_000);
 await signInSettings(page);
 await page.goto("/workspace/account/settings/print-templates");
 await page.getByLabel("Page size",{exact:false}).selectOption("A5");await page.getByLabel("Orientation",{exact:false}).selectOption("LANDSCAPE");await page.getByLabel("Set Terms & Conditions",{exact:false}).fill("Print audit terms");await page.getByLabel("Print Page Numbers",{exact:false}).check();
 await page.getByRole("button",{name:"Save Invoice Print Settings",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();await page.reload();await expect(page.getByLabel("Page size",{exact:false})).toHaveValue("A5");
 const html=await page.request.get(`/api/account/print/SALES_INVOICE/${printDocumentId}`);expect(html.status()).toBe(200);expect(await html.text()).toContain("Print audit terms");
 const response=await page.request.get(`/api/account/print/SALES_INVOICE/${printDocumentId}?format=pdf`);expect(response.status()).toBe(200);const pdf=await PDFDocument.load(await response.body());expect(pdf.getPage(0).getWidth()).toBeGreaterThan(pdf.getPage(0).getHeight());expect(Math.round(pdf.getPage(0).getWidth())).toBe(595);
 const token=createSessionToken(),sessionUser=await db.user.findUniqueOrThrow({where:{id:userId}});
 await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:sessionUser.sessionVersion}});
 const mobilePdf=await page.request.get(`/api/v1/mobile/account/print/SALES_INVOICE/${printDocumentId}`,{headers:{authorization:`Bearer ${token}`}});expect(mobilePdf.status()).toBe(200);expect((await mobilePdf.body()).subarray(0,4).toString()).toBe("%PDF");
 const missingAuth=await page.request.get(`/api/v1/mobile/account/print/SALES_INVOICE/${printDocumentId}`);expect(missingAuth.status()).toBe(401);
 const missingDocument=await page.request.get(`/api/v1/mobile/account/print/SALES_INVOICE/${randomUUID()}`,{headers:{authorization:`Bearer ${token}`}});expect(missingDocument.status()).toBe(404);

 await page.goto("/workspace/account/settings/reminders");await page.getByRole("link",{name:/Payment Reminders/}).click();await expect(page).toHaveURL(/reminders\/payment$/);await page.getByRole("link",{name:/Reminder message to party/}).click();await page.getByRole("textbox",{name:"Reminder message",exact:true}).fill("Hello {party}, please pay {amount} for {document}.");await page.getByRole("button",{name:"Save Reminder Message"}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole("textbox",{name:"Reminder message",exact:true})).toHaveValue("Hello {party}, please pay {amount} for {document}.");
 await page.goto("/workspace/account/settings/reminders/payment");await page.getByRole("checkbox",{name:/Self Payment Reminder/}).check();await expect.poll(async()=>{const row=await db.accountSettings.findUniqueOrThrow({where:{companyId}});return (row.transactionDefaults as {reminderSettings:{payment:{enabled:boolean}}}).reminderSettings.payment.enabled}).toBe(true);await page.reload();await expect(page.getByRole("checkbox",{name:/Self Payment Reminder/})).toBeChecked();
 await page.goto("/workspace/account/settings/reminders/service");await page.getByRole("checkbox",{name:"Reminder verification item"}).check();await page.getByRole("spinbutton",{name:"Service Period (No. of Days)"}).fill("45");await page.getByRole("button",{name:"Add Reminder"}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole("checkbox",{name:"Reminder verification item"})).toBeChecked();await expect(page.getByRole("spinbutton",{name:"Service Period (No. of Days)"})).toHaveValue("45");
 await page.goto("/workspace/account/settings/transaction-sms");await page.getByRole("checkbox",{name:"Send to party"}).check();await page.getByRole("checkbox",{name:"Prepare Copy to Self"}).check();await page.getByRole("checkbox",{name:"Include Invoice Link"}).check();await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole("checkbox",{name:"Send to party"})).toBeChecked();
 await page.goto("/workspace/account/settings/transactions");await page.getByRole("textbox",{name:"Sale invoices prefix",exact:true}).fill("AUD");await page.getByRole("button",{name:"Save Transaction Settings",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole("textbox",{name:"Sale invoices prefix",exact:true})).toHaveValue("AUD");await page.getByRole("link",{name:/Due Dates and Payment terms/}).click();await page.getByRole("spinbutton",{name:"Default Due Days"}).fill("15");await page.getByRole("textbox",{name:"Sale Terms & Conditions",exact:true}).fill("Payment within fifteen days");await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole("spinbutton",{name:"Default Due Days"})).toHaveValue("15");
 const defaults=(await db.accountSettings.findUniqueOrThrow({where:{companyId}})).transactionDefaults as {invoicePrintSettings:{pageSize:string};reminderSettings:{payment:{message:string};service:{periodDays:number}};transactionMessaging:{sendToParty:boolean};defaultDueDays:number};expect(defaults.invoicePrintSettings.pageSize).toBe("A5");expect(defaults.reminderSettings.payment.message).toContain("Hello {party}");expect(defaults.reminderSettings.service.periodDays).toBe(45);expect(defaults.transactionMessaging.sendToParty).toBe(true);expect(defaults.defaultDueDays).toBe(15);
 await page.goto("/workspace/account/settings/transactions");
 await page.getByRole("checkbox",{name:"Billing name of Parties",exact:true}).uncheck();
 await page.getByRole("checkbox",{name:"Cash Sale by default",exact:true}).check();
 await page.getByRole("checkbox",{name:"Invoice/Bill Number",exact:true}).uncheck();
 await page.getByRole("checkbox",{name:"Terms & Conditions",exact:true}).uncheck();
 await page.getByRole("button",{name:"Save Transaction Settings",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();
 await page.goto("/workspace/account/transactions/new?type=SALES_INVOICE");
 await expect(page.getByText("Billing Name (Optional)",{exact:true})).toHaveCount(0);
 await expect(page.getByText("Invoice No.",{exact:true})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Cash",exact:true})).toHaveClass(/active/);
 await expect(page.getByText("Terms & Conditions",{exact:true})).toHaveCount(0);

});


test("A102 public invoice link is scoped, revocable and opens without sign-in",async({playwright})=>{
 const current=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),defaults=(current.transactionDefaults??{}) as { [key:string]: import("@prisma/client").Prisma.JsonValue;transactionPreferences:import("@prisma/client").Prisma.JsonObject };
 await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{...defaults,transactionMessaging:{sendToParty:true,copyToSelf:false,includeInvoiceLink:true}}}});
 const invoice=await db.commercialDocument.update({where:{id:printDocumentId},data:{status:"POSTED"}});
 const url=invoiceShareUrl(invoice),request=await playwright.request.newContext();
 try{
  const response=await request.get(url);expect(response.status()).toBe(200);expect(await response.text()).toContain("PRINT-97");expect(response.headers()["x-robots-tag"]).toContain("noindex");
  const pdf=await request.get(`${url}?format=pdf`);expect(pdf.status()).toBe(200);expect((await pdf.body()).subarray(0,4).toString()).toBe("%PDF");
  const tampered=await request.get(`${url}x`);expect(tampered.status()).toBe(404);
  await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{...defaults,transactionMessaging:{sendToParty:true,copyToSelf:false,includeInvoiceLink:false}}}});
  expect((await request.get(url)).status()).toBe(404);
  await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{...defaults,transactionMessaging:{sendToParty:true,copyToSelf:false,includeInvoiceLink:true}}}});
  const expired=invoiceShareUrl(invoice,new Date(Date.now()-31*86400000));
  expect((await request.get(expired)).status()).toBe(404);
 }finally{
  await request.dispose();await db.accountSettings.update({where:{companyId},data:{transactionDefaults:defaults}});
 }
});


test("A103 header toggles reach sale entry and invoice metadata survives saving and print",async({page})=>{
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),defaults=(original.transactionDefaults??{}) as { [key:string]: import("@prisma/client").Prisma.JsonValue;transactionPreferences:import("@prisma/client").Prisma.JsonObject };
 await db.accountSettings.update({where:{companyId},data:{enabledModules:["SALES","INVENTORY"],transactionDefaults:{...defaults,transactionPreferences:{...(defaults.transactionPreferences??{}),billingName:true,customerPoDetails:true,transactionTime:true,ewayBillNumber:true}}}});
 try{
  await signInSettings(page);
  await page.goto("/workspace/account/transactions/new?type=SALES_INVOICE");await expect(page.getByRole("textbox",{name:"Customer PO Number",exact:true})).toBeVisible();await expect(page.getByLabel("Transaction Time",{exact:true})).toBeVisible();await expect(page.getByLabel("E-Way Bill No.",{exact:true})).toBeVisible();
  const user=await db.user.findUniqueOrThrow({where:{id:userId}});
  const saved=await createCommercialDocumentForActor({...user,companyId,branchAccessScope:"SELECTED_BRANCHES",branchIds:[branchId]}, {type:"SALES_INVOICE",branchId,partyId:customerId,billingName:"Alternate billing name",customerPoNumber:"PO-103",customerPoDate:"2026-10-10",transactionTime:"09:15",ewayBillNumber:"123456789012",issueDate:"2026-10-11",taxMode:"EXCLUSIVE",lines:[{lineType:"PRODUCT",sourceId:productId,quantity:"1",rate:"100",taxRate:"0"}]});
  await db.commercialDocument.update({where:{id:saved.id},data:{status:"POSTED"}});const history=await recentSalePrices({companyId,branchAccessScope:"SELECTED_BRANCHES",branchIds:[branchId]},true);expect(history.some(x=>x.sourceId===productId&&x.rate.toString()==="100")).toBe(true);expect(await recentSalePrices({companyId:otherCompanyId},true)).toEqual([]);const stored=await db.commercialDocument.findUniqueOrThrow({where:{id:saved.id}});expect(stored.billingName).toBe("Alternate billing name");expect(stored.customerPoNumber).toBe("PO-103");expect(stored.transactionTime).toBe("09:15");
  const printed=await page.request.get(`/api/account/print/SALES_INVOICE/${saved.id}`);expect(printed.status()).toBe(200);const html=await printed.text();for(const value of ["Alternate billing name","PO-103","09:15","123456789012"])expect(html).toContain(value);
 }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules,transactionDefaults:defaults}})}
});


test("A103 item switches enable barcode selection, history and zero-price free quantities",async({page})=>{
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),defaults=(original.transactionDefaults??{}) as { [key:string]: import("@prisma/client").Prisma.JsonValue;transactionPreferences:import("@prisma/client").Prisma.JsonObject };
 await db.accountProduct.update({where:{id:productId},data:{barcode:"CODE-103",salePrice:"100",costPrice:"50"}});
 await db.accountSettings.update({where:{companyId},data:{enabledModules:["SALES","INVENTORY"],transactionDefaults:{...defaults,transactionPreferences:{...(defaults.transactionPreferences??{}),barcodeScanning:true,freeItemQuantity:true,lastFiveSalePrices:true,displayPurchasePrice:true,itemCount:true}}}});
 try{
  await signInSettings(page);
  await page.goto("/workspace/account/transactions/new?type=SALES_INVOICE");await page.getByRole("button",{name:/Add Items/}).click();await page.getByRole("textbox",{name:"Scan item barcode",exact:true}).fill("CODE-103");await page.getByRole("textbox",{name:"Scan item barcode",exact:true}).press("Enter");
  const picker=page.locator("section").filter({has:page.getByRole("heading",{name:"Add Items to Sale",exact:true})});await expect(picker.getByRole("heading",{name:"Last 5 Sale Prices",exact:true})).toBeVisible();await picker.getByRole("spinbutton",{name:"Free Item quantity",exact:true}).fill("3");await picker.getByRole("button",{name:"Save",exact:true}).click();
  await expect(page.getByText("Total Qty:4",{exact:true})).toBeVisible();await expect(page.getByText("Reminder verification item",{exact:true})).toHaveCount(2);
 }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules,transactionDefaults:defaults}})}
});

test("A103 branch selection loads and saves only that branch's numbering prefixes",async({page})=>{
 const secondBranchId=randomUUID();
 await db.branch.create({data:{id:secondBranchId,companyId,name:"Second numbering branch",code:`SECOND-${secondBranchId.slice(0,8)}`}});
 await db.numberingSeries.create({data:{companyId,branchId:secondBranchId,seriesKey:"SALES_INVOICE",prefix:"SECOND",padding:2}});
 const primary=await db.numberingSeries.findFirst({where:{companyId,branchId,seriesKey:"SALES_INVOICE"}});
 try{
  await signInSettings(page);
  await page.goto(`/workspace/account/settings/transactions?branchId=${branchId}`);
  const selector=page.getByRole("combobox",{name:"Firm / company branch",exact:true});const prefix=page.getByRole("textbox",{name:"Sale invoices prefix",exact:true});
  await prefix.fill("UNSAVED-PRIMARY");await selector.selectOption(secondBranchId);await expect(prefix).toHaveValue("SECOND");
  await selector.selectOption(branchId);await expect(prefix).toHaveValue("UNSAVED-PRIMARY");await selector.selectOption(secondBranchId);await prefix.fill("SECOND-UPDATED");
  await page.getByRole("button",{name:"Save Transaction Settings",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();
  expect((await db.numberingSeries.findFirst({where:{companyId,branchId,seriesKey:"SALES_INVOICE"}}))?.prefix).toBe(primary?.prefix);
  expect((await db.numberingSeries.findFirst({where:{companyId,branchId:secondBranchId,seriesKey:"SALES_INVOICE"}}))?.prefix).toBe("SECOND-UPDATED");
 }finally{await db.numberingSeries.deleteMany({where:{companyId,branchId:secondBranchId}});await db.branch.delete({where:{id:secondBranchId}})}
});


test("A103 every transaction toggle retains both on and off values after reopening",async({page})=>{
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try{
  await signInSettings(page);
  for(const enabled of [true,false]){
   await page.goto(`/workspace/account/settings/transactions?branchId=${branchId}`);
   for(const [,label] of Object.values(TRANSACTION_TOGGLES).flat())await page.getByRole("checkbox",{name:label,exact:true}).setChecked(enabled);
   await page.getByRole("button",{name:"Save Transaction Settings",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();await page.reload();
   const defaults=(await db.accountSettings.findUniqueOrThrow({where:{companyId}})).transactionDefaults as {transactionPreferences:Record<string,boolean>};
   for(const [key,label] of Object.values(TRANSACTION_TOGGLES).flat()){
    await expect(page.getByRole("checkbox",{name:label,exact:true})).toBeChecked({checked:enabled});expect(defaults.transactionPreferences[key]).toBe(enabled);
   }
  }
 }finally{await db.accountSettings.update({where:{companyId},data:{transactionDefaults:original.transactionDefaults??{},itemSettings:original.itemSettings??{}}})}
});


test("A097 every invoice print toggle retains both on and off values after reopening",async({page})=>{
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try{
  await signInSettings(page);
  for(const enabled of [true,false]){
   await page.goto("/workspace/account/settings/print-templates");
   for(const key of PRINT_BOOLS)await page.locator(`input[name="${key}"]`).setChecked(enabled);
   await page.getByRole("button",{name:"Save Invoice Print Settings",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();await page.reload();
   const defaults=(await db.accountSettings.findUniqueOrThrow({where:{companyId}})).transactionDefaults as {invoicePrintSettings:Record<string,boolean>};
   for(const key of PRINT_BOOLS){await expect(page.locator(`input[name="${key}"]`)).toBeChecked({checked:enabled});expect(defaults.invoicePrintSettings[key]).toBe(enabled)}
  }
 }finally{await db.accountSettings.update({where:{companyId},data:{transactionDefaults:original.transactionDefaults??{}}})}
});


test("A103 payment discount settles 100 with 90 cash and preserves journal and print amounts",async({page})=>{
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),defaults=(original.transactionDefaults??{}) as import("@prisma/client").Prisma.JsonObject;
 await db.accountSettings.update({where:{companyId},data:{displayDecimalPlaces:2,enabledModules:["SALES","CUSTOMER_RECEIPTS","INVENTORY"],transactionDefaults:{...defaults,transactionPreferences:{discountDuringPayment:true},invoicePrintSettings:{receivedAmount:true,balanceAmount:true}}}});
 try{
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Discount verification year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  const user=await db.user.findUniqueOrThrow({where:{id:userId}}),actor={...user,companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
  const invoice=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",branchId,partyId:customerId,issueDate:"2026-10-11",lines:[{lineType:"CUSTOM",itemName:"Discount verification",quantity:"1",rate:"100",taxRate:"0"}]});
  await postCommercialDocumentForActor(actor,{documentId:invoice.id});
  await signInSettings(page);await page.goto("/workspace/account/transactions/money?type=CUSTOMER_RECEIPT");
  await page.getByLabel("Customer",{exact:true}).selectOption(customerId);await page.getByLabel("Allocation target",{exact:false}).selectOption(`document:${invoice.id}`);await page.getByLabel("Payment mode",{exact:false}).selectOption("CASH");await page.getByLabel("Amount",{exact:true}).fill("90");await page.getByLabel("Payment Discount",{exact:true}).fill("11");await page.getByRole("button",{name:"Post transaction",exact:true}).click();await expect(page.locator("form").getByRole("alert")).toHaveText("Cash received plus payment discount cannot exceed the invoice balance.");expect(await db.accountSettlement.count({where:{companyId,amount:"90"}})).toBe(0);await expect(page.getByLabel("Amount",{exact:true})).toHaveValue("90");await page.getByLabel("Payment Discount",{exact:true}).fill("10");await page.getByRole("button",{name:"Post transaction",exact:true}).click();
  await expect.poll(async()=>await db.accountSettlement.count({where:{companyId,amount:"90",discountAmount:"10"}})).toBe(1);
  const receipt=await db.accountSettlement.findFirstOrThrow({where:{companyId,discountAmount:"10"},include:{allocations:true,journalEntry:{include:{lines:{include:{ledgerAccount:true}}}}}});
  expect(receipt.allocations[0].amount.toString()).toBe("100");expect(receipt.allocations[0].discountAmount.toString()).toBe("10");
  expect(receipt.journalEntry).not.toBeNull();if(!receipt.journalEntry)throw new Error("Posted cash receipt requires a journal");
  expect(receipt.journalEntry.lines.find(row=>row.ledgerAccount.systemKey==="CASH")?.debit.toString()).toBe("90");expect(receipt.journalEntry.lines.find(row=>row.ledgerAccount.systemKey==="SALES_INCOME")?.debit.toString()).toBe("10");expect(receipt.journalEntry.lines.find(row=>row.ledgerAccount.systemKey==="ACCOUNTS_RECEIVABLE")?.credit.toString()).toBe("100");
  const outstanding=await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,invoice.id));expect(outstanding.outstanding.toString()).toBe("0");
  await page.goto(`/workspace/account/sales/${invoice.id}`);const detail=page.locator("main").last();await expect(detail.locator("div").filter({has:page.getByText("Received",{exact:true})}).last()).toHaveText(/Received₹90\.00/);await expect(detail.locator("div").filter({has:page.getByText("Payment discount",{exact:true})}).last()).toHaveText(/Payment discount₹10\.00/);await expect(detail.locator("div").filter({has:page.getByText("Balance Due",{exact:true})}).last()).toHaveText(/Balance Due₹0\.00/);
  const html=await page.request.get(`/api/account/print/SALES_INVOICE/${invoice.id}`);expect(html.status()).toBe(200);expect(await html.text()).toMatch(/<span>Received<\/span><b>90\.00<\/b>/);expect(await html.text()).toMatch(/<span>Balance due<\/span><b>0\.00<\/b>/);expect(await html.text()).toContain("Payment discount");expect(await html.text()).toContain("Payment mode: CASH");await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{transactionPreferences:{discountDuringPayment:true},invoicePrintSettings:{paymentMode:false}}}});const hiddenMode=await page.request.get(`/api/account/print/SALES_INVOICE/${invoice.id}`);expect(await hiddenMode.text()).not.toContain("Payment mode: CASH");
  const retry={idempotencyKey:receipt.idempotencyKey,type:"CUSTOMER_RECEIPT",branchId,partyId:customerId,paymentMode:"CASH",amount:"90",transactionDate:"2026-10-11",reference:receipt.reference??undefined,notes:receipt.notes??undefined,allocations:[{documentId:invoice.id,amount:"100",discountAmount:"10"}]};
  expect((await createSettlementForActor(actor,retry)).id).toBe(receipt.id);
  await expect(createSettlementForActor(actor,{...retry,allocations:[{documentId:invoice.id,amount:"100",discountAmount:"9"}]})).rejects.toThrow("ALLOCATION_TOTAL_MISMATCH");
  await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{transactionPreferences:{discountDuringPayment:false}}}});
  await expect(createSettlementForActor(actor,{...retry,idempotencyKey:randomUUID()})).rejects.toThrow("PAYMENT_DISCOUNT_DISABLED");
 }finally{await db.accountSettings.update({where:{companyId},data:{displayDecimalPlaces:original.displayDecimalPlaces,enabledModules:original.enabledModules,transactionDefaults:original.transactionDefaults??{}}})}
});

test("A101 service period switches snapshot sale days and completion removes only the chosen reminder",async({page})=>{
 test.setTimeout(90000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),defaults=(original.transactionDefaults??{}) as import("@prisma/client").Prisma.JsonObject;
 const service=await db.accountService.create({data:{companyId,name:"Lifecycle verification service",sellingRate:"100",taxRate:"0"}});
 const config={enabled:true,allowSalePeriodOverride:true,periodDays:60,selectedItemIds:[service.id],message:"Hi {Party name}, {Item name} is due {reminder date}."};
 await db.accountSettings.update({where:{companyId},data:{enabledModules:["SALES","INVENTORY"],transactionDefaults:{...defaults,reminderSettings:{service:config}}}});
 try{
  await signInSettings(page);await page.goto("/workspace/account/settings/reminders/service");
  const periodControl=page.getByRole("spinbutton",{name:"Service Period (No. of Days)",exact:true});const bounds=await periodControl.boundingBox();expect(bounds?.width).toBeGreaterThan(200);
  await periodControl.fill("");await expect(page.getByRole("button",{name:"Add Reminder",exact:true})).toBeDisabled();await periodControl.fill("60");
  const reminderMessage=page.getByRole("textbox",{name:"Reminder Message",exact:true}),savedMessage=await reminderMessage.inputValue();await reminderMessage.fill("Draft reminder for {Party name}\nItem {Item name}");await page.getByRole("button",{name:"Preview Reminder Message",exact:true}).click();await expect(page.getByRole("dialog",{name:"Reminder Message",exact:true})).toContainText("Draft reminder for {Party name}");await page.screenshot({path:`/workspace/work/a101-reminder-preview-${test.info().project.name}.png`});await page.keyboard.press("Escape");await expect(page.getByRole("dialog",{name:"Reminder Message",exact:true})).not.toBeVisible();await expect(page.getByRole("button",{name:"Preview Reminder Message",exact:true})).toBeFocused();await reminderMessage.fill(savedMessage);
  const override=page.getByRole("checkbox",{name:"Edit service period for a party while making a sale",exact:true});await expect(override).toBeChecked();await override.uncheck();await page.getByRole("button",{name:"Add Reminder",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();await page.reload();await expect(override).not.toBeChecked();
  const user=await db.user.findUniqueOrThrow({where:{id:userId}}),actor={...user,companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
  const input={type:"SALES_INVOICE",branchId,partyId:customerId,issueDate:"2026-10-01",lines:[{lineType:"SERVICE",sourceId:service.id,quantity:"1",rate:"100",taxRate:"0",servicePeriodDays:5}]};
  await expect(createCommercialDocumentForActor(actor,input)).rejects.toThrow("SERVICE_PERIOD_OVERRIDE_DISABLED");
  await override.check();await page.getByRole("button",{name:"Add Reminder",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();
  await page.goto("/workspace/account/transactions/new?type=SALES_INVOICE");await page.getByRole("button",{name:/Add Items/}).click();await page.getByText(service.name,{exact:true}).click();const picker=page.locator("section").filter({has:page.getByRole("heading",{name:"Add Items to Sale",exact:true})});await picker.getByRole("button",{name:"Save",exact:true}).click();await expect(page.getByRole("spinbutton",{name:`Service Period for ${service.name}`,exact:true})).toHaveValue("60");await page.getByRole("spinbutton",{name:`Service Period for ${service.name}`,exact:true}).fill("5");
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Service verification year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  const invoice=await createCommercialDocumentForActor(actor,input);await postCommercialDocumentForActor(actor,{documentId:invoice.id});
  const line=await db.commercialDocumentLine.findFirstOrThrow({where:{documentId:invoice.id}});expect(line.servicePeriodDays).toBe(5);
  const defaultSale=await createCommercialDocumentForActor(actor,{...input,lines:[{...input.lines[0],servicePeriodDays:undefined}]});expect((await db.commercialDocumentLine.findFirstOrThrow({where:{documentId:defaultSale.id}})).servicePeriodDays).toBe(60);
  await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{...defaults,reminderSettings:{service:{...config,periodDays:100}}}}});
  expect((await dueServiceReminders(actor)).find(row=>row.lineId===line.id)?.dueDate).toBe("2026-10-06T00:00:00.000Z");
  await expect(completeServiceReminder({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},line.id)).rejects.toThrow("INVALID_SERVICE_REMINDER");
  await page.goto("/workspace/account/notifications");const card=page.locator("section").filter({has:page.getByRole("heading",{name:`${service.name} — Print fixture customer`,exact:true})});await card.getByRole("button",{name:"Mark service completed",exact:true}).click();await expect.poll(()=>db.serviceReminderCompletion.count({where:{companyId,lineId:line.id}})).toBe(1);await page.reload();await expect(page.getByRole("heading",{name:`${service.name} — Print fixture customer`,exact:true})).toHaveCount(0);expect((await dueServiceReminders(actor)).some(row=>row.lineId===line.id)).toBe(false);
  const returnedSale=await createCommercialDocumentForActor(actor,{...input,lines:[{...input.lines[0],quantity:"2"}]});await postCommercialDocumentForActor(actor,{documentId:returnedSale.id});
  const returnedLine=await db.commercialDocumentLine.findFirstOrThrow({where:{documentId:returnedSale.id}});
  const creditInput={type:"CREDIT_NOTE",branchId,partyId:customerId,sourceDocumentId:returnedSale.id,issueDate:"2026-10-11",lines:[{lineType:"SERVICE",sourceId:service.id,sourceCommercialLineId:returnedLine.id,quantity:"1",rate:"100",taxRate:"0"}]};
  const firstCredit=await createCommercialDocumentForActor(actor,creditInput);
  expect((await dueServiceReminders(actor)).some(row=>row.lineId===returnedLine.id)).toBe(true);
  await postCommercialDocumentForActor(actor,{documentId:firstCredit.id});expect((await dueServiceReminders(actor)).some(row=>row.lineId===returnedLine.id)).toBe(true);
  const finalCredit=await createCommercialDocumentForActor(actor,creditInput);await postCommercialDocumentForActor(actor,{documentId:finalCredit.id});expect((await dueServiceReminders(actor)).some(row=>row.lineId===returnedLine.id)).toBe(false);
  await expect(completeServiceReminder(actor,returnedLine.id)).rejects.toThrow("INVALID_SERVICE_REMINDER");
  const deletedSale=await createCommercialDocumentForActor(actor,input);await postCommercialDocumentForActor(actor,{documentId:deletedSale.id});
  expect((await dueServiceReminders(actor)).some(row=>row.documentId===deletedSale.id)).toBe(true);await reversePostedSaleForActor(actor,deletedSale.id);expect((await dueServiceReminders(actor)).some(row=>row.documentId===deletedSale.id)).toBe(false);
  await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{...defaults,reminderSettings:{service:{...config,enabled:false}}}}});expect(await dueServiceReminders(actor)).toEqual([]);
 }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules,transactionDefaults:original.transactionDefaults??{}}})}
});

test("A088 backup downloads settings and accounting snapshots with tenant isolation and matching checksum",async({page})=>{
 await signInSettings(page);
 const response=await page.request.get("/api/account/utilities/backup");expect(response.status()).toBe(200);
 const bytes=await response.body(),checksum=createHash("sha256").update(bytes).digest("hex");expect(response.headers()["x-content-sha256"]).toBe(checksum);
 const bundle=JSON.parse(bytes.toString());expect(bundle.manifest.formatVersion).toBe(2);expect(bundle.data.id).toBe(companyId);expect(bundle.data.accountSettings.companyId).toBe(companyId);
 expect(bundle.data.customers.some((row:{id:string})=>row.id===customerId)).toBe(true);expect(bundle.data.accountProducts.some((row:{id:string})=>row.id===productId)).toBe(true);expect(bundle.data.commercialDocuments.some((row:{id:string})=>row.id===printDocumentId)).toBe(true);
 expect(bundle.data.asset.some((row:{id:string})=>row.id===assetId)).toBe(true);
 for(const name of ["commercialDocuments","commercialDocumentLine","settlements","settlementAllocations","journalEntries","journalLines","stockMovement","projectMaterialMovement","expenseTransaction","loan","serviceReminderCompletion","customFieldValues"]){expect(Array.isArray(bundle.data[name])).toBe(true);expect(bundle.manifest.recordCounts[name]).toBe(bundle.data[name].length)}
 expect(bundle.data.serviceReminderCompletion.length).toBe(await db.serviceReminderCompletion.count({where:{companyId}}));expect(bundle.data.journalLines.length).toBe(await db.journalLine.count({where:{companyId}}));
 expect(bundle.data.users).toEqual(expect.arrayContaining([expect.objectContaining({id:userId})]));expect(bytes.toString()).not.toContain(otherCompanyId);expect(bytes.toString()).not.toContain('"passwordHash"');expect(bytes.toString()).not.toContain('"sessionVersion"');expect(bytes.toString()).not.toContain('"sessions"');
 const record=await db.accountBackupRecord.findFirstOrThrow({where:{companyId,checksum}});expect(record.manifest).toMatchObject({formatVersion:2});expect(await db.accountingAuditEvent.count({where:{companyId,eventType:"BACKUP_GENERATED",entityId:record.id}})).toBe(1);
 const archive=await createAccountBackupForActor({id:userId,companyId,accountRole:"ACCOUNT_ADMIN"},true);
 const archived=await db.accountBackupRecord.findFirstOrThrow({where:{companyId,checksum:archive.checksum},orderBy:{generatedAt:"desc"}}),key=(archived.manifest as {objectKey:string}).objectKey;
 try{const download=await page.request.get(`/api/account/utilities/backup/${archived.id}`);expect(download.status()).toBe(200);expect(download.headers()["x-content-sha256"]).toBe(archive.checksum);expect(createHash("sha256").update(await download.body()).digest("hex")).toBe(archive.checksum);expect((await page.request.get(`/api/account/utilities/backup/${randomUUID()}`)).status()).toBe(404);
 await page.goto("/workspace/account/settings/backup");const historyDownload=page.waitForEvent("download");await page.locator(`a[href="/api/account/utilities/backup/${archived.id}"]`).click();expect((await historyDownload).suggestedFilename()).toBe(`account-backup-${archived.id}.json`);
 const auto=page.getByRole("checkbox",{name:"Enable auto backup",exact:true});for(const enabled of [true,false]){await auto.setChecked(enabled);await page.getByRole("spinbutton",{name:"Automatic Backup Interval (days)",exact:true}).fill("5");await page.getByRole("spinbutton",{name:"Manual Backup Reminder (days)",exact:true}).fill("3");await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible();await page.reload();await expect(auto).toBeChecked({checked:enabled});expect((await db.accountSettings.findUniqueOrThrow({where:{companyId}})).transactionDefaults).toMatchObject({backupSettings:{autoBackup:enabled,intervalDays:5,manualReminderDays:3}})}
 await page.goto("/workspace/account/utilities/backup");const manualDownload=page.waitForEvent("download");await page.getByRole("link",{name:"Generate & download",exact:true}).click();expect((await manualDownload).suggestedFilename()).toMatch(/^salespunch360-.*\.json$/);
 }finally{await privateStorage().delete(key)}

});


test("A103 links customer advances once and full payment collects only the remaining cash",async({page})=>{
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 const customer=await db.customer.create({data:{companyId,branchId,name:"Advance linking verification",isAccountCustomer:true}});
 const otherBranch=await db.branch.create({data:{companyId,name:"Advance isolated branch",code:`ADV-${randomUUID().slice(0,8)}`}});
 const user=await db.user.findUniqueOrThrow({where:{id:userId}}),actor={...user,companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
 const principal={...actor,productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const]};
 const defaults=(original.transactionDefaults??{}) as import("@prisma/client").Prisma.JsonObject;
 async function link(enabled:boolean){await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{...defaults,transactionPreferences:{linkPayments:enabled}}}})}
 async function advance(amount:string,branch:string=branchId,party:string=customer.id){return createSettlementForActor(actor,{type:"CUSTOMER_ADVANCE",branchId:branch,partyId:party,amount,paymentMode:"CASH",transactionDate:"2026-10-11",idempotencyKey:randomUUID(),allocations:[]})}
 function invoice(amount:string){return {type:"SALES_INVOICE",branchId,partyId:customer.id,issueDate:"2026-10-11",idempotencyKey:randomUUID(),lines:[{lineType:"CUSTOM",itemName:"Advance test",quantity:"1",rate:amount,taxRate:"0"}]}}
 try{
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Advance verification year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  await link(true);
  const otherCustomer=await db.customer.create({data:{companyId,branchId:otherBranch.id,name:"Other advance customer",isAccountCustomer:true}});
  const isolated=await advance("25",otherBranch.id,otherCustomer.id),first=await advance("100");
  const payload={...invoice("150"),receivedInFull:true,paymentType:"CASH"};
  const sale=await mobileCreateSales(principal,payload);
  expect((await db.accountSettlement.findUniqueOrThrow({where:{id:first.id}})).remainingAmount.toString()).toBe("0");
  expect((await db.accountSettlement.findUniqueOrThrow({where:{id:isolated.id}})).remainingAmount.toString()).toBe("25");
  const application=await db.advanceApplication.findFirstOrThrow({where:{documentId:sale.id}});expect(application.amount.toString()).toBe("100");
  const receipt=await db.accountSettlement.findUniqueOrThrow({where:{companyId_idempotencyKey:{companyId,idempotencyKey:`mobile-sale-receipt:${sale.id}`}}});expect(receipt.amount.toString()).toBe("50");
  const applicationLines=await db.journalLine.findMany({where:{journalEntryId:application.journalEntryId},include:{ledgerAccount:true}});
  expect(applicationLines.map(x=>x.ledgerAccount.systemKey).sort()).toEqual(["ACCOUNTS_RECEIVABLE","CUSTOMER_ADVANCES"]);
  expect((await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,sale.id))).outstanding.toString()).toBe("0");
  expect((await mobileCreateSales(principal,payload)).id).toBe(sale.id);
  expect(await db.advanceApplication.count({where:{documentId:sale.id}})).toBe(1);expect(await db.settlementAllocation.count({where:{documentId:sale.id}})).toBe(1);
  const excess=await advance("200"),covered=await mobileCreateSales(principal,{...invoice("80"),receivedInFull:true});
  expect((await db.accountSettlement.findUniqueOrThrow({where:{id:excess.id}})).remainingAmount.toString()).toBe("120");
  expect(await db.settlementAllocation.count({where:{documentId:covered.id}})).toBe(0);
  await link(false);const unlinked=await createCommercialDocumentForActor(actor,invoice("50"));await postCommercialDocumentForActor(actor,{documentId:unlinked.id});
  expect(await db.advanceApplication.count({where:{documentId:unlinked.id}})).toBe(0);expect((await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,unlinked.id))).outstanding.toString()).toBe("50");
  await applyAdvanceForActor(actor,{advanceId:excess.id,documentId:unlinked.id,amount:"50",applicationDate:"2026-10-11",idempotencyKey:randomUUID()});
  expect((await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,unlinked.id))).outstanding.toString()).toBe("0");
  await link(true);
  const webCustomer=await db.customer.create({data:{companyId,branchId,name:"Web advance cash customer",isAccountCustomer:true}});await advance("40",branchId,webCustomer.id);
  const webService=await db.accountService.create({data:{companyId,name:"Web advance sale service",sellingRate:"100",taxRate:"0"}});
  await signInSettings(page);await page.goto("/workspace/account/transactions/new?type=SALES_INVOICE");
  await page.getByPlaceholder("Search customer name or phone").fill(webCustomer.name);await page.getByRole("button",{name:new RegExp(webCustomer.name)}).click();
  await page.getByRole("button",{name:/Add Items/}).click();await page.getByText(webService.name,{exact:true}).click();const picker=page.locator("section").filter({has:page.getByRole("heading",{name:"Add Items to Sale",exact:true})});await picker.getByRole("button",{name:"Save",exact:true}).click();
  await page.getByRole("button",{name:"Cash",exact:true}).click();await expect(page.getByText("Advance applied",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Save",exact:true}).click();
  await expect.poll(()=>db.accountSettlement.findFirst({where:{companyId,partyId:webCustomer.id,type:"CUSTOMER_RECEIPT"}}).then(row=>row?.amount.toString())).toBe("60");
  const webSale=await db.commercialDocument.findFirstOrThrow({where:{companyId,partyId:webCustomer.id,type:"SALES_INVOICE",status:"POSTED"}});
  expect((await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,webSale.id))).outstanding.toString()).toBe("0");

 }finally{await db.accountSettings.update({where:{companyId},data:{transactionDefaults:original.transactionDefaults??{}}})}
});


test("A103 reverse charge excludes seller GST liability and collects only payable cash",async({page})=>{
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),defaults=(original.transactionDefaults??{}) as import("@prisma/client").Prisma.JsonObject;
 const customer=await db.customer.create({data:{companyId,branchId,name:"Reverse charge verification",isAccountCustomer:true,stateCode:"29"}});
 const service=await db.accountService.create({data:{companyId,name:"Reverse charge verification service",sellingRate:"100",taxRate:"18"}});
 const user=await db.user.findUniqueOrThrow({where:{id:userId}}),actor={...user,companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
 const input={type:"SALES_INVOICE",branchId,partyId:customer.id,issueDate:"2026-10-11",reverseCharge:true,stateOfSupplyCode:"29",lines:[{lineType:"SERVICE",sourceId:service.id,quantity:"1",rate:"100",taxRate:"18"}]};
 try{
  await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{...defaults,transactionPreferences:{reverseCharge:true}}}});
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Reverse charge verification year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  const source=await createCommercialDocumentForActor(actor,input);await postCommercialDocumentForActor(actor,{documentId:source.id});expect(source.grandTotal.toString()).toBe("118");expect(source.payableAmount?.toString()).toBe("100");
  const lines=await db.journalLine.findMany({where:{journalEntry:{companyId,sourceId:source.id}},include:{ledgerAccount:true}});expect(lines.map(x=>x.ledgerAccount.systemKey).sort()).toEqual(["ACCOUNTS_RECEIVABLE","SALES_INCOME"]);expect(lines.reduce((sum,row)=>sum+Number(row.debit),0)).toBe(100);expect(lines.reduce((sum,row)=>sum+Number(row.credit),0)).toBe(100);
  const sourceLine=await db.commercialDocumentLine.findFirstOrThrow({where:{documentId:source.id}}),credit=await createCommercialDocumentForActor(actor,{...input,type:"CREDIT_NOTE",reverseCharge:false,sourceDocumentId:source.id,lines:[{...input.lines[0],sourceCommercialLineId:sourceLine.id,quantity:"0.4"}]});await postCommercialDocumentForActor(actor,{documentId:credit.id});expect(credit.payableAmount?.toString()).toBe("40");expect((await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,source.id))).outstanding.toString()).toBe("60");
  const creditLines=await db.journalLine.findMany({where:{journalEntry:{companyId,sourceId:credit.id}},include:{ledgerAccount:true}});expect(creditLines.map(x=>x.ledgerAccount.systemKey).sort()).toEqual(["ACCOUNTS_RECEIVABLE","SALES_INCOME"]);
  await signInSettings(page);await page.goto("/workspace/account/transactions/new?type=SALES_INVOICE");await page.getByPlaceholder("Search customer name or phone").fill(customer.name);await page.getByRole("button",{name:new RegExp(customer.name)}).click();await page.getByRole("button",{name:/Add Items/}).click();await page.getByText(service.name,{exact:true}).click();const picker=page.locator("section").filter({has:page.getByRole("heading",{name:"Add Items to Sale",exact:true})});await picker.getByRole("button",{name:"Save",exact:true}).click();await page.getByRole("checkbox",{name:"Reverse Charge",exact:true}).check();await page.getByRole("button",{name:"Cash",exact:true}).click();await expect(page.getByText("Reverse charge: GST is payable by the recipient.",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Save",exact:true}).click();
  await expect.poll(()=>db.accountSettlement.findFirst({where:{companyId,partyId:customer.id,type:"CUSTOMER_RECEIPT"}}).then(row=>row?.amount.toString())).toBe("100");
  const receipt=await db.accountSettlement.findFirstOrThrow({where:{companyId,partyId:customer.id,type:"CUSTOMER_RECEIPT"},include:{allocations:true}}),saleId=receipt.allocations[0].documentId;
  expect((await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,saleId))).outstanding.toString()).toBe("0");
  const print=await page.request.get(`/api/account/print/SALES_INVOICE/${saleId}`);expect(print.status()).toBe(200);const html=await print.text();expect(html).toContain("GST payable by recipient (reverse charge)");expect(html).toMatch(/<span>Payable amount<\/span><b>100(?:\.0+)?<\/b>/);expect(html).toMatch(/<span>Received<\/span><b>100(?:\.0+)?<\/b>/);expect(html).toMatch(/<span>Balance due<\/span><b>0(?:\.0+)?<\/b>/);
  await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{...defaults,transactionPreferences:{reverseCharge:true,roundOff:true,roundingStep:1}}}});
  const rounded=await createCommercialDocumentForActor(actor,{...input,lines:[{...input.lines[0],rate:"100.4"}]});expect(rounded.roundOffAmount.toString()).toBe("-0.4");expect(rounded.payableAmount?.toString()).toBe("100");await postCommercialDocumentForActor(actor,{documentId:rounded.id});
  const roundedLines=await db.journalLine.findMany({where:{journalEntry:{companyId,sourceId:rounded.id}}});expect(roundedLines.reduce((sum,row)=>sum+Number(row.debit),0)).toBe(100);expect(roundedLines.reduce((sum,row)=>sum+Number(row.credit),0)).toBe(100);
  await page.goto(`/workspace/account/sales/${rounded.id}/edit`);await expect(page.getByRole("heading",{name:"Sale",exact:true})).toBeVisible();await page.getByRole("button",{name:/^Edit item /}).first().click();await page.getByLabel("Rate (Price/Unit)",{exact:true}).fill("120.4");await page.locator("section").filter({has:page.getByRole("heading",{name:"Add Items to Sale",exact:true})}).getByRole("button",{name:"Save",exact:true}).click();await page.getByRole("button",{name:"Save",exact:true}).click();
  await expect.poll(()=>db.$transaction(tx=>documentOutstandingInTx(tx,companyId,rounded.id)).then(doc=>doc.outstanding.toString())).toBe("0");expect((await db.commercialDocument.findUniqueOrThrow({where:{id:rounded.id}})).status).toBe("POSTED");
  const edited=await db.commercialDocument.findFirstOrThrow({where:{companyId,partyId:customer.id,type:"SALES_INVOICE",status:"POSTED",lines:{some:{rate:"120.4"}}}});await expect(page).toHaveURL(new RegExp(`/workspace/account/sales/${edited.id}$`));expect(edited.reverseCharge).toBe(true);expect(edited.payableAmount?.toString()).toBe("120");
  const editedJournal=await db.journalLine.findMany({where:{journalEntry:{companyId,sourceId:edited.id}},include:{ledgerAccount:true}});expect(editedJournal.map(row=>row.ledgerAccount.systemKey).sort()).toEqual(["ACCOUNTS_RECEIVABLE","SALES_INCOME"]);
  await page.goto(`/workspace/account/sales/${rounded.id}/edit`);await expect(page.getByText("This sale has a payment or adjustment and cannot be edited.",{exact:true})).toBeVisible();await page.getByRole("link",{name:"View Sale",exact:true}).click();await expect(page).toHaveURL(new RegExp(`/workspace/account/sales/${rounded.id}$`));
  await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{...defaults,transactionPreferences:{reverseCharge:false}}}});await expect(createCommercialDocumentForActor(actor,input)).rejects.toThrow("REVERSE_CHARGE_DISABLED");
 }finally{await db.accountSettings.update({where:{companyId},data:{transactionDefaults:original.transactionDefaults??{}}})}
});


test("A103 free tracked items consume stock and cost for ordinary batch and distinct serial items",async({page})=>{
 test.setTimeout(90000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),defaults=(original.transactionDefaults??{}) as import("@prisma/client").Prisma.JsonObject;
 const customer=await db.customer.create({data:{companyId,branchId,name:"Free stock verification",isAccountCustomer:true}}),warehouse=await db.warehouse.create({data:{companyId,branchId,name:"Free stock warehouse",code:"FREE-TEST",isDefault:true}});
 const user=await db.user.findUniqueOrThrow({where:{id:userId}}),actor={...user,companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
 try{
  await db.accountSettings.update({where:{companyId},data:{negativeStockAllowed:false,transactionDefaults:{...defaults,transactionPreferences:{freeItemQuantity:true}}}});
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Free stock verification year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  await signInSettings(page);
  for(const trackingMode of ["NONE","BATCH","SERIAL"] as const){
   const product=await db.accountProduct.create({data:{companyId,name:`Free stock ${trackingMode}`,salePrice:"100",costPrice:"30",taxRate:"0",trackInventory:true,trackingMode}});
   const batch=trackingMode==="BATCH"?await db.inventoryBatch.create({data:{companyId,productId:product.id,batchNumber:"FREE-BATCH"}}):null;
   const serials=trackingMode==="SERIAL"?await Promise.all(["FREE-SERIAL-1","FREE-SERIAL-2"].map(serialNumber=>db.inventorySerialNumber.create({data:{companyId,productId:product.id,serialNumber}}))):[];
   for(const serial of serials.length?serials:[null])await createStockMovementForActor(actor,"OPENING",{warehouseId:warehouse.id,productId:product.id,quantity:serial?"1":"5",unitCost:"30",batchId:batch?.id,serialNumberId:serial?.id,movementDate:"2026-10-10",sourceType:"OPENING",sourceId:randomUUID()});
   await page.goto("/workspace/account/transactions/new?type=SALES_INVOICE");await page.getByPlaceholder("Search customer name or phone").fill(customer.name);await page.getByRole("button",{name:new RegExp(customer.name)}).click();await page.getByRole("button",{name:/Add Items/}).click();await page.getByText(product.name,{exact:true}).click();const picker=page.locator("section").filter({has:page.getByRole("heading",{name:"Add Items to Sale",exact:true})});await picker.getByRole("spinbutton",{name:"Free Item quantity",exact:true}).fill("1");
   if(batch)await picker.getByRole("combobox",{name:"Batch",exact:true}).selectOption(batch.id);
   if(serials.length){await picker.getByRole("combobox",{name:"Serial Number",exact:true}).selectOption(serials[0].id);await picker.getByRole("spinbutton",{name:"Free Item quantity",exact:true}).fill("2");await picker.getByRole("button",{name:"Save",exact:true}).click();await expect(picker.getByRole("alert")).toContainText("different serial");await picker.getByRole("spinbutton",{name:"Free Item quantity",exact:true}).fill("1");await picker.getByRole("combobox",{name:"Free Item Serial Number",exact:true}).selectOption(serials[1].id);}
   await picker.getByRole("button",{name:"Save",exact:true}).click();await page.getByRole("button",{name:"Save",exact:true}).click();
   await expect.poll(()=>db.commercialDocumentLine.findFirst({where:{companyId,productId:product.id,document:{status:"POSTED"}}}).then(line=>line?.documentId)).toBeTruthy();
   const soldLines=await db.commercialDocumentLine.findMany({where:{companyId,productId:product.id,document:{status:"POSTED"}},orderBy:{position:"asc"}});expect(soldLines.map(line=>line.rate.toString())).toEqual(["100","0"]);const documentId=soldLines[0].documentId;
   const sales=await db.stockMovement.findMany({where:{companyId,sourceId:documentId}});expect(sales.length).toBe(2);expect(sales.reduce((sum,row)=>sum+Number(row.quantity),0)).toBe(2);expect(sales.reduce((sum,row)=>sum+Number(row.totalCost),0)).toBe(60);
   if(batch)expect(sales.every(row=>row.batchId===batch.id)).toBe(true);if(serials.length)expect(new Set(sales.map(row=>row.serialNumberId)).size).toBe(2);
   const journal=await db.journalLine.findMany({where:{journalEntry:{companyId,sourceId:documentId}},include:{ledgerAccount:true}});expect(journal.find(row=>row.ledgerAccount.systemKey==="COGS")?.debit.toString()).toBe("60");expect(journal.find(row=>row.ledgerAccount.systemKey==="SALES_INCOME")?.credit.toString()).toBe("100");expect(journal.reduce((sum,row)=>sum+Number(row.debit),0)).toBe(journal.reduce((sum,row)=>sum+Number(row.credit),0));
   await postCommercialDocumentForActor(actor,{documentId});expect(await db.stockMovement.count({where:{companyId,sourceId:documentId}})).toBe(2);
   const editPayload={idempotencyKey:randomUUID(),type:"SALES_INVOICE",branchId,partyId:customer.id,issueDate:"2026-10-11",lines:soldLines.map(line=>({lineType:"PRODUCT",sourceId:product.id,quantity:line.quantity.toString(),rate:line.rate.isZero()?"0":"110",taxRate:"0",warehouseId:warehouse.id,batchId:line.batchId??undefined,serialNumberId:line.serialNumberId??undefined}))};
   let replacementId:string;
   if(trackingMode==="NONE"){
    const principal={...actor,productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const]};
    replacementId=(await mobileReplaceSale(principal,documentId,editPayload)).id;
    const concurrentSource=replacementId;
    const edits=await Promise.allSettled(["120","130"].map(rate=>mobileReplaceSale(principal,concurrentSource,{...editPayload,idempotencyKey:randomUUID(),lines:editPayload.lines.map((line,index)=>({...line,rate:index===0?rate:"0"}))})));
    expect(edits.filter(result=>result.status==="fulfilled")).toHaveLength(1);expect(edits.filter(result=>result.status==="rejected")).toHaveLength(1);
    const winner=edits.find(result=>result.status==="fulfilled");if(!winner||winner.status!=="fulfilled")throw new Error("Expected one committed replacement");replacementId=winner.value.id;
    expect(await db.commercialDocument.count({where:{companyId,sourceDocumentId:concurrentSource,type:"CREDIT_NOTE",status:"POSTED"}})).toBe(1);


   }else{
    await page.goto(`/workspace/account/sales/${documentId}/edit`);await page.getByRole("button",{name:/^Edit item /}).first().click();await page.getByLabel("Rate (Price/Unit)",{exact:true}).fill("110");await page.locator("section").filter({has:page.getByRole("heading",{name:"Add Items to Sale",exact:true})}).getByRole("button",{name:"Save",exact:true}).click();await page.getByRole("button",{name:"Save",exact:true}).click();
    await expect(page).toHaveURL(/\/workspace\/account\/sales\/[a-f0-9-]+$/);
    replacementId=page.url().split("/").at(-1)!;
   }
   if(batch){
    const principal={...actor,productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const]};
    const before={documents:await db.commercialDocument.count({where:{companyId}}),stock:await db.stockMovement.count({where:{companyId}}),journals:await db.journalEntry.count({where:{companyId}})};
    await expect(mobileReplaceSale(principal,replacementId,{...editPayload,idempotencyKey:randomUUID(),lines:editPayload.lines.map((line,index)=>({...line,quantity:index===0?"6":"1"}))})).rejects.toThrow("INSUFFICIENT_STOCK");
    expect(await db.commercialDocument.count({where:{companyId}})).toBe(before.documents);expect(await db.stockMovement.count({where:{companyId}})).toBe(before.stock);expect(await db.journalEntry.count({where:{companyId}})).toBe(before.journals);
    expect((await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,replacementId))).outstanding.toString()).toBe("110");
   }
   expect((await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,documentId))).outstanding.toString()).toBe("0");
   expect((await db.commercialDocument.findUniqueOrThrow({where:{id:documentId}})).status).toBe("POSTED");
   const replacementStock=await db.stockMovement.findMany({where:{companyId,sourceId:replacementId}});expect(replacementStock.length).toBe(2);expect(replacementStock.reduce((sum,row)=>sum+Number(row.totalCost),0)).toBe(60);
   if(batch)expect(replacementStock.every(row=>row.batchId===batch.id)).toBe(true);if(serials.length)expect(new Set(replacementStock.map(row=>row.serialNumberId))).toEqual(new Set(serials.map(row=>row.id)));
   const originalCredit=await db.commercialDocument.findFirstOrThrow({where:{companyId,sourceDocumentId:documentId,type:"CREDIT_NOTE",status:"POSTED"}});expect(await db.stockMovement.count({where:{companyId,sourceId:originalCredit.id}})).toBe(2);
   const principal={...actor,productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const]};
   await expect(mobileReplaceSale({...principal,branchAccessScope:"SELECTED_BRANCHES",branchIds:[randomUUID()]},replacementId,editPayload)).rejects.toThrow();
   await expect(mobileReplaceSale({...principal,companyId:otherCompanyId},replacementId,editPayload)).rejects.toThrow();
   if(serials.length){await mobileDeleteSale(principal,replacementId);expect((await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,replacementId))).outstanding.toString()).toBe("0");const returns=await db.commercialDocument.findMany({where:{companyId,sourceDocumentId:replacementId,type:"CREDIT_NOTE",status:"POSTED"}});expect(returns).toHaveLength(1);expect(await db.stockMovement.count({where:{companyId,sourceId:returns[0].id}})).toBe(2);await expect(mobileDeleteSale(principal,replacementId)).resolves.toEqual({ok:true});expect(await db.commercialDocument.count({where:{companyId,sourceDocumentId:replacementId,type:"CREDIT_NOTE",status:"POSTED"}})).toBe(1)}


  }
 }finally{await db.accountSettings.update({where:{companyId},data:{negativeStockAllowed:original.negativeStockAllowed,transactionDefaults:original.transactionDefaults??{}}})}
});

test("A103 state defaults and invoice tax discount switches reach GST posting",async({page})=>{
 test.setTimeout(90000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),defaults=(original.transactionDefaults??{}) as import("@prisma/client").Prisma.JsonObject;
 const branch=await db.branch.findUniqueOrThrow({where:{id:branchId}});
 const customers=await Promise.all(["29","27"].map(stateCode=>db.customer.create({data:{companyId,branchId,name:`Tax posting ${stateCode}`,stateCode,isAccountCustomer:true}})));
 const service=await db.accountService.create({data:{companyId,name:"Invoice tax override service",sellingRate:"100",taxRate:"5"}});
 try{
  await db.branch.update({where:{id:branchId},data:{gstStateCode:"29"}});
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Tax switch verification year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  await signInSettings(page);
  for(const scenario of [{customer:customers[0],enabled:true},{customer:customers[1],enabled:true},{customer:customers[1],enabled:false}]){
   await db.accountSettings.update({where:{companyId},data:{defaultStateCode:"29",transactionDefaults:{...defaults,transactionPreferences:{stateOfSupply:scenario.enabled,transactionTax:scenario.enabled,transactionDiscount:scenario.enabled,roundOff:false,invoicePreview:false}}}});
   await page.goto("/workspace/account/transactions/new?type=SALES_INVOICE");await page.getByPlaceholder("Search customer name or phone").fill(scenario.customer.name);await page.getByRole("button",{name:new RegExp(scenario.customer.name)}).click();
   if(scenario.enabled)await expect(page.getByRole("combobox",{name:"State of Supply",exact:true})).toHaveValue(scenario.customer.stateCode!);else await expect(page.getByRole("combobox",{name:"State of Supply",exact:true})).toHaveCount(0);
   await page.getByRole("button",{name:/Add Items/}).click();await page.getByText(service.name,{exact:true}).click();const picker=page.locator("section").filter({has:page.getByRole("heading",{name:"Add Items to Sale",exact:true})});await picker.getByRole("button",{name:"Save",exact:true}).click();
   if(scenario.enabled){await page.getByRole("combobox",{name:"Transaction Tax (%)",exact:true}).selectOption("18");await page.getByRole("spinbutton",{name:"Transaction Discount (%)",exact:true}).fill("10")}else{await expect(page.getByRole("combobox",{name:"Transaction Tax (%)",exact:true})).toHaveCount(0);await expect(page.getByRole("spinbutton",{name:"Transaction Discount (%)",exact:true})).toHaveCount(0)}
   await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/account\/sales\/[a-f0-9-]+$/);const id=page.url().split("/").at(-1)!;
   const sale=await db.commercialDocument.findUniqueOrThrow({where:{id},include:{lines:true}});expect(sale.stateOfSupplyCode).toBe(scenario.customer.stateCode);expect(sale.taxableTotal.toString()).toBe(scenario.enabled?"90":"100");expect(sale.grandTotal.toString()).toBe(scenario.enabled?"106.2":"105");expect(sale.lines[0].taxRate.toString()).toBe(scenario.enabled?"18":"5");
   const journal=await db.journalLine.findMany({where:{journalEntry:{companyId,sourceId:id}},include:{ledgerAccount:true}});
   if(scenario.customer.stateCode==="29"){expect(sale.cgstTotal.toString()).toBe("8.1");expect(sale.sgstTotal.toString()).toBe("8.1");expect(journal.filter(line=>["CGST_PAYABLE","SGST_PAYABLE"].includes(line.ledgerAccount.systemKey??"")).map(line=>line.credit.toString())).toEqual(["8.1","8.1"])}else{expect(sale.igstTotal.toString()).toBe(scenario.enabled?"16.2":"5");expect(journal.find(line=>line.ledgerAccount.systemKey==="IGST_PAYABLE")?.credit.toString()).toBe(scenario.enabled?"16.2":"5")}
   expect(journal.reduce((sum,line)=>sum+Number(line.debit),0)).toBeCloseTo(journal.reduce((sum,line)=>sum+Number(line.credit),0));
  }
 }finally{await db.accountSettings.update({where:{companyId},data:{defaultStateCode:original.defaultStateCode,transactionDefaults:original.transactionDefaults??{}}});await db.branch.update({where:{id:branchId},data:{gstStateCode:branch.gstStateCode}})}
});


test.use({permissions:["camera"],launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream","--use-file-for-fake-video-capture=/workspace/work/a103-camera.y4m"]}});

test.describe("A103 barcode camera",()=>{
 const cameraFile="/workspace/work/a103-camera.y4m";

 test.beforeAll(async()=>{
  const {QRCodeWriter,BarcodeFormat}=await import("@zxing/library");
  const {writeFile}=await import("node:fs/promises");
  const size=480,matrix=new QRCodeWriter().encode("CAMERA-103",BarcodeFormat.QR_CODE,size,size,new Map());
  const frame=Buffer.alloc(size*size*3/2,128);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)frame[y*size+x]=matrix.get(x,y)?0:255;
  await writeFile(cameraFile,Buffer.concat([Buffer.from(`YUV4MPEG2 W${size} H${size} F30:1 Ip A1:1 C420jpeg\n`),...Array.from({length:90},()=>Buffer.concat([Buffer.from("FRAME\n"),frame]))]));
 });
 test("decodes camera frames, releases camera and respects the switch",async({page})=>{
  const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),defaults=(original.transactionDefaults??{}) as import("@prisma/client").Prisma.JsonObject;
  await db.accountProduct.update({where:{id:productId},data:{barcode:"CAMERA-103"}});
  try{
   await db.accountSettings.update({where:{companyId},data:{enabledModules:["SALES","INVENTORY"],transactionDefaults:{...defaults,transactionPreferences:{barcodeScanning:true}}}});
   await page.addInitScript(()=>{
    const media=navigator.mediaDevices,original=media.getUserMedia.bind(media);
    const tracks:MediaStreamTrack[]=[];
    const state={cameraTracks:tracks,cameraHold:true,releaseCamera:()=>{}};
    Object.assign(window,state);
    media.getUserMedia=async constraints=>{const stream=await original(constraints);tracks.push(...stream.getTracks());if((window as unknown as typeof state).cameraHold)await new Promise<void>(resolve=>{(window as unknown as typeof state).releaseCamera=resolve});return stream};
   });
   await signInSettings(page);await page.goto("/workspace/account/transactions/new?type=SALES_INVOICE");await page.getByRole("button",{name:/Add Items/}).click();
   await page.getByRole("button",{name:"Scan with Camera",exact:true}).click();
   await expect.poll(()=>page.evaluate(()=>(window as unknown as {cameraTracks:MediaStreamTrack[]}).cameraTracks.length)).toBeGreaterThan(0);
   await page.getByRole("button",{name:"Close camera",exact:true}).click();
   await page.evaluate(()=>{const state=window as unknown as {cameraHold:boolean;releaseCamera:()=>void};state.cameraHold=false;state.releaseCamera()});
   await expect.poll(()=>page.evaluate(()=>(window as unknown as {cameraTracks:MediaStreamTrack[]}).cameraTracks.every(track=>track.readyState==="ended"))).toBe(true);
   await expect(page.getByRole("button",{name:"Scan with Camera",exact:true})).toBeFocused();
   await page.getByRole("button",{name:"Scan with Camera",exact:true}).click();
   await expect(page.getByRole("dialog",{name:"Scan item barcode"})).toHaveCount(0,{timeout:20000});
   await expect(page.locator('input[readonly][value="Reminder verification item"]')).toHaveValue("Reminder verification item");
   await expect.poll(()=>page.evaluate(()=>{const tracks=(window as unknown as {cameraTracks:MediaStreamTrack[]}).cameraTracks;return tracks.length>0&&tracks.every(track=>track.readyState==="ended")})).toBe(true);
   await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{...defaults,transactionPreferences:{barcodeScanning:false}}}});
   await page.reload();await page.getByRole("button",{name:/Add Items/}).click();await expect(page.getByRole("button",{name:"Scan with Camera",exact:true})).toHaveCount(0);
  }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules,transactionDefaults:original.transactionDefaults??{}}})}
 });
 test("camera denial allows manual entry",async({page})=>{
  await db.accountProduct.update({where:{id:productId},data:{barcode:"CAMERA-103"}});
  const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),defaults=(original.transactionDefaults??{}) as import("@prisma/client").Prisma.JsonObject;
  try{
   await db.accountSettings.update({where:{companyId},data:{enabledModules:["SALES","INVENTORY"],transactionDefaults:{...defaults,transactionPreferences:{barcodeScanning:true}}}});
   await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException("Denied","NotAllowedError")}});
   await signInSettings(page);await page.goto("/workspace/account/transactions/new?type=SALES_INVOICE");await page.getByRole("button",{name:/Add Items/}).click();await page.getByRole("button",{name:"Scan with Camera",exact:true}).click();
   await expect(page.getByRole("dialog",{name:"Scan item barcode"}).getByRole("alert")).toContainText("Camera access was denied");await page.getByRole("button",{name:"Use manual entry",exact:true}).click();await expect(page.getByRole("dialog",{name:"Scan item barcode"})).toHaveCount(0);
   await page.getByRole("textbox",{name:"Scan item barcode",exact:true}).fill("CAMERA-103");await page.getByRole("textbox",{name:"Scan item barcode",exact:true}).press("Enter");await expect(page.locator('input[readonly][value="Reminder verification item"]')).toHaveValue("Reminder verification item");
  }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules,transactionDefaults:original.transactionDefaults??{}}})}
 });
});

test("A103 terms defaults reach purchase drafts and switch off cleanly",async({page})=>{
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),defaults=(original.transactionDefaults??{}) as import("@prisma/client").Prisma.JsonObject;
 const vendor=await db.vendor.create({data:{companyId,name:"Terms purchase supplier"}});
 if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Purchase terms verification year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
 try{
  await signInSettings(page);
  for(const enabled of [true,false]){
   await db.accountSettings.update({where:{companyId},data:{enabledModules:["SALES","PURCHASES","PURCHASE_ORDER"],transactionDefaults:{...defaults,purchaseTerms:"Goods subject to purchase inspection",salesTerms:"Sale terms",transactionPreferences:{termsEnabled:enabled}}}});
   await page.goto("/workspace/account/transactions/new?type=PURCHASE_ORDER");
   await expect(page.getByLabel("Notes",{exact:true})).toHaveValue(enabled?"Goods subject to purchase inspection":"");
   await page.getByText("Advanced purchase purpose",{exact:true}).click();await page.getByRole("combobox",{name:/^Purpose/}).selectOption("GENERAL_OFFICE");
   await page.getByRole("combobox",{name:/^Vendor/}).selectOption(vendor.id);await page.getByLabel("Name",{exact:true}).fill(`Terms purchase ${enabled}`);await page.getByLabel("Rate",{exact:true}).fill("100");
   await page.getByRole("button",{name:"Create Draft",exact:true}).click();
   await expect(page).toHaveURL(/\/workspace\/account\/transactions\/[a-f0-9-]+$/);
   await expect.poll(()=>db.commercialDocumentLine.findFirst({where:{companyId,itemName:`Terms purchase ${enabled}`},include:{document:true}}).then(line=>line?.document.notes??null)).toBe(enabled?"Goods subject to purchase inspection":"");
  }
 }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules,transactionDefaults:original.transactionDefaults??{}}})}
});


test("A089 custom field editing clears optional values and keeps typed required values",async()=>{
 const fields=await Promise.all([{fieldKey:"optional_reference",label:"Optional reference",dataType:"TEXT" as const,isRequired:false},{fieldKey:"confirmed",label:"Confirmed",dataType:"BOOLEAN" as const,isRequired:true},{fieldKey:"measurement",label:"Measurement",dataType:"NUMBER" as const,isRequired:true}].map(field=>db.customFieldDefinition.create({data:{companyId,entityType:"CUSTOMER",...field}})));
 const user=await db.user.findUniqueOrThrow({where:{id:userId}}),principal={...user,companyId,productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const],branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
 const customer=await saveMobileAccountMaster(principal,"customers",{name:"Custom fields roundtrip",branchId,customFields:{optional_reference:"Old reference",confirmed:"false",measurement:"1.25"}});
 if(!("record" in customer))throw new Error("Expected party detail");
 const id=customer.record.id;
 await saveMobileAccountMaster(principal,"customers",{name:"Custom fields roundtrip",branchId,customFields:{optional_reference:""}},id);
 const values=await db.customFieldValue.findMany({where:{companyId,entityId:id},include:{definition:true}});
 expect(values.find(value=>value.definition.fieldKey==="optional_reference")).toBeUndefined();expect(values.find(value=>value.definition.fieldKey==="confirmed")?.value).toBe(false);expect(values.find(value=>value.definition.fieldKey==="measurement")?.value).toBe(1.25);
 await expect(saveMobileAccountMaster(principal,"customers",{name:"Rejected required fields",branchId,customFields:{confirmed:"false"}})).rejects.toThrow("CUSTOM_FIELDS_REQUIRED");expect(await db.customer.count({where:{companyId,name:"Rejected required fields"}})).toBe(0);
 const otherCompany=await db.company.findUniqueOrThrow({where:{id:otherCompanyId}});
 await db.company.update({where:{id:otherCompanyId},data:{subscriptionStatus:"TRIAL",trialStartedAt:new Date(),trialEndsAt:new Date(Date.now()+86400000)}});
 try{
  await expect(saveMobileAccountMaster({...principal,companyId:otherCompanyId},"customers",{name:"Wrong company",branchId,customFields:{optional_reference:"Forged"}},id)).rejects.toThrow("MOBILE_FORBIDDEN");
 }finally{await db.company.update({where:{id:otherCompanyId},data:{subscriptionStatus:otherCompany.subscriptionStatus,trialStartedAt:otherCompany.trialStartedAt,trialEndsAt:otherCompany.trialEndsAt}})}
 expect(await db.customFieldValue.count({where:{companyId:otherCompanyId,entityId:id}})).toBe(0);
 await db.customFieldDefinition.update({where:{id:fields[0].id},data:{isActive:false}});await saveMobileAccountMaster(principal,"customers",{name:"Custom fields roundtrip",branchId,customFields:{optional_reference:"Ignored inactive field"}},id);expect(await db.customFieldValue.count({where:{companyId,entityId:id,definitionId:fields[0].id}})).toBe(0);
 await db.customFieldDefinition.updateMany({where:{id:{in:fields.map(field=>field.id)}},data:{isActive:false}});
});


test("A089 product and service custom fields persist and reject incomplete item creation",async({page})=>{
 test.setTimeout(90000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 const fields=await Promise.all((["PRODUCT","SERVICE"] as const).map(entityType=>db.customFieldDefinition.create({data:{companyId,entityType,fieldKey:"item_reference",label:entityType==="PRODUCT"?"Product reference":"Service reference",dataType:"TEXT",isRequired:true}})));
 try{
 await db.accountSettings.update({where:{companyId},data:{enabledModules:["SALES","INVENTORY"]}});
 await signInSettings(page);
 for(const kind of ["products","services"] as const){
  await page.goto("/workspace/account/inventory/items/new");
  if(kind==="services")await page.getByRole("button",{name:"Services",exact:true}).click();
  const name=`Custom ${kind} ${randomUUID()}`;
  await page.getByLabel("Item Name *",{exact:true}).fill(name);
  const label=kind==="products"?"Product reference":"Service reference";
  await page.getByRole("button",{name:"Save",exact:true}).click();
  expect(kind==="products"?await db.accountProduct.count({where:{companyId,name}}):await db.accountService.count({where:{companyId,name}})).toBe(0);
  await page.getByLabel(label,{exact:true}).fill("Verified reference");
  await page.getByRole("button",{name:"Save",exact:true}).click();
  await expect(page).toHaveURL(/\/workspace\/account\/inventory$/);
  const row=kind==="products"?await db.accountProduct.findFirstOrThrow({where:{companyId,name}}):await db.accountService.findFirstOrThrow({where:{companyId,name}});
  expect((await db.customFieldValue.findFirstOrThrow({where:{companyId,entityId:row.id,entityType:kind==="products"?"PRODUCT":"SERVICE"}})).value).toBe("Verified reference");
 }
 const user=await db.user.findUniqueOrThrow({where:{id:userId}}),principal={...user,companyId,productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const],branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
 for(const kind of ["items","services"] as const){
  const name=`Rejected ${kind}`;
  await expect(saveMobileAccountMaster(principal,kind,{name})).rejects.toThrow("CUSTOM_FIELDS_REQUIRED");
  expect(kind==="items"?await db.accountProduct.count({where:{companyId,name}}):await db.accountService.count({where:{companyId,name}})).toBe(0);
  const row=await saveMobileAccountMaster(principal,kind,{name:`Mobile ${kind}`,customFields:{item_reference:"API reference"}});
  if(!("id" in row))throw new Error("Expected new item");
  await expect(saveMobileAccountMaster(principal,kind,{name:`Invalid ${kind}`,customFields:{item_reference:""}},row.id)).rejects.toThrow("CUSTOM_FIELDS_REQUIRED");
  expect((await db.customFieldValue.findFirstOrThrow({where:{companyId,entityId:row.id}})).value).toBe("API reference");
 }
 }finally{await db.customFieldDefinition.updateMany({where:{id:{in:fields.map(field=>field.id)}},data:{isActive:false}});await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules}})}
});


test("A089 project fields save reopen and rollback the automatic customer on rejection",async({page})=>{
 test.setTimeout(90000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 const field=await db.customFieldDefinition.create({data:{companyId,entityType:"PROJECT",fieldKey:"site_reference",label:"Site reference",dataType:"TEXT",isRequired:true}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS"]}});
  await signInSettings(page);await page.goto("/workspace/account/projects/new");
  const name=`Custom project ${randomUUID()}`;
  await page.getByLabel("Project name",{exact:true}).fill(name);await page.getByLabel("Site reference",{exact:true}).fill("SITE-1");
  await page.getByRole("button",{name:"Create project",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/account\/projects\/[a-f0-9-]+$/);
  const project=await db.project.findFirstOrThrow({where:{companyId,name}});
  expect((await db.customFieldValue.findFirstOrThrow({where:{companyId,entityId:project.id,definitionId:field.id}})).value).toBe("SITE-1");
  await page.goto(`/workspace/account/projects/${project.id}/edit`);await expect(page.getByLabel("Site reference",{exact:true})).toHaveValue("SITE-1");
  await page.getByLabel("Site reference",{exact:true}).fill("SITE-2");await page.getByRole("button",{name:"Save project",exact:true}).click();await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
  expect((await db.customFieldValue.findFirstOrThrow({where:{companyId,entityId:project.id,definitionId:field.id}})).value).toBe("SITE-2");
  const user=await db.user.findUniqueOrThrow({where:{id:userId}}),actor={...user,companyId,branchIds:[]} as ProjectActor;
  const rejected=`Rejected project ${randomUUID()}`;
  await expect(createSimpleProjectForActor(actor,{name:rejected,branchId,projectValue:"0"})).rejects.toThrow("CUSTOM_FIELDS_REQUIRED");
  expect(await db.project.count({where:{companyId,name:rejected}})).toBe(0);expect(await db.customer.count({where:{companyId,name:rejected}})).toBe(0);
  await expect(updateProjectForActor(actor,{projectId:project.id,name:"Rejected edit",status:"ACTIVE",projectValue:"0",customFields:{site_reference:""}})).rejects.toThrow("CUSTOM_FIELDS_REQUIRED");
  expect((await db.project.findUniqueOrThrow({where:{id:project.id}})).name).toBe(name);
  const principal={...user,companyId,productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const],branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
  const nativeProject=await mobileCreateProject(principal,{name:"Native custom project",branchId,customFields:{site_reference:"NATIVE-1"}});
  expect((await mobileProjectOptions(principal,nativeProject.id)).customValues.site_reference).toBe("NATIVE-1");
  await mobileUpdateProject(principal,{projectId:nativeProject.id,name:"Native custom project",status:"ACTIVE",customFields:{site_reference:"NATIVE-2"}});
  expect((await mobileProjectOptions(principal,nativeProject.id)).customValues.site_reference).toBe("NATIVE-2");
  const key=randomUUID(),replay=await createSimpleProjectForActor(actor,{name:"Replay project",branchId,idempotencyKey:key,customFields:{site_reference:"REPLAY"}});
  expect((await createSimpleProjectForActor(actor,{name:"Replay project",branchId,idempotencyKey:key,customFields:{site_reference:"REPLAY"}})).id).toBe(replay.id);
  await expect(createSimpleProjectForActor(actor,{name:"Replay project",branchId,idempotencyKey:key,customFields:{site_reference:"CHANGED"}})).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
 }finally{await db.customFieldDefinition.update({where:{id:field.id},data:{isActive:false}});await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules}})}
});


test("A089 asset custom fields reopen clear optional values and reject incomplete creates",async({page})=>{
 test.setTimeout(90000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 const fields=await Promise.all([{fieldKey:"asset_reference",label:"Asset reference",isRequired:true},{fieldKey:"asset_optional",label:"Optional asset note",isRequired:false}].map(field=>db.customFieldDefinition.create({data:{companyId,entityType:"ASSET",dataType:"TEXT",...field}})));
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["ASSETS"]}});
  await signInSettings(page);await page.goto(`/workspace/account/assets/${assetId}/edit`);
  await page.getByLabel("Asset reference",{exact:true}).fill("ASSET-1");await page.getByLabel("Optional asset note",{exact:true}).fill("Old note");
  await page.getByRole("button",{name:"Save asset",exact:true}).click();await expect(page).toHaveURL(new RegExp(`/assets/${assetId}$`));
  await page.goto(`/workspace/account/assets/${assetId}/edit`);await expect(page.getByLabel("Asset reference",{exact:true})).toHaveValue("ASSET-1");await expect(page.getByLabel("Optional asset note",{exact:true})).toHaveValue("Old note");
  await page.getByLabel("Optional asset note",{exact:true}).fill("");await page.getByRole("button",{name:"Save asset",exact:true}).click();await expect(page).toHaveURL(new RegExp(`/assets/${assetId}$`));
  expect(await db.customFieldValue.count({where:{companyId,entityId:assetId,definitionId:fields[1].id}})).toBe(0);
  const user=await db.user.findUniqueOrThrow({where:{id:userId}}),principal={...user,companyId,productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const],branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
  const name=`Rejected asset ${randomUUID()}`;
  await expect(mobileSaveAsset(principal,{branchId,name,assetType:"EQUIPMENT",purchaseDate:"2026-10-11",purchaseValue:"10"})).rejects.toThrow("CUSTOM_FIELDS_REQUIRED");
  expect(await db.asset.count({where:{companyId,name}})).toBe(0);
  await mobileSaveAsset(principal,{customFields:{asset_reference:"NATIVE-1"}},assetId);
  expect((await mobileAssetDetail(principal,assetId)).customValues.asset_reference).toBe("NATIVE-1");
  await expect(mobileSaveAsset(principal,{name:"Rejected asset edit",customFields:{asset_reference:""}},assetId)).rejects.toThrow("CUSTOM_FIELDS_REQUIRED");
  expect((await db.asset.findUniqueOrThrow({where:{id:assetId}})).name).toBe("Settings verification equipment");
 }finally{await db.customFieldDefinition.updateMany({where:{id:{in:fields.map(field=>field.id)}},data:{isActive:false}});await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules}})}
});

test("A089 invoice fields save print reopen and preserve the original replacement snapshot",async({page})=>{
 test.setTimeout(90000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),defaults=(original.transactionDefaults??{}) as import("@prisma/client").Prisma.JsonObject;
 const field=await db.customFieldDefinition.create({data:{companyId,entityType:"SALES_INVOICE",fieldKey:"rate",label:"Invoice site reference",dataType:"TEXT",isRequired:true,validation:{showInPrint:true}}});
 const user=await db.user.findUniqueOrThrow({where:{id:userId}}),actor={...user,companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]},principal={...actor,productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const]};
 const customer=await db.customer.create({data:{companyId,branchId,name:"Invoice custom field customer",isAccountCustomer:true}}),service=await db.accountService.create({data:{companyId,name:"Invoice custom field service",sellingRate:"100",taxRate:"0"}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["SALES"],transactionDefaults:{...defaults,transactionPreferences:{invoicePreview:false,cashSaleByDefault:false,linkPaymentsToInvoices:false}}}});
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Invoice fields year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  const payload={type:"SALES_INVOICE",branchId,partyId:customer.id,issueDate:"2026-10-11",lines:[{lineType:"SERVICE",sourceId:service.id,quantity:"1",rate:"100",taxRate:"0"}]};
  const before=await db.commercialDocument.count({where:{companyId}});
  await expect(mobileCreateSales(principal,payload)).rejects.toThrow("CUSTOM_FIELDS_REQUIRED");expect(await db.commercialDocument.count({where:{companyId}})).toBe(before);
  await signInSettings(page);await page.goto("/workspace/account/transactions/new?type=SALES_INVOICE");await page.getByPlaceholder("Search customer name or phone").fill(customer.name);await page.getByRole("button",{name:new RegExp(customer.name)}).click();await page.getByRole("button",{name:/Add Items/}).click();await page.getByText(service.name,{exact:true}).click();const picker=page.locator("section").filter({has:page.getByRole("heading",{name:"Add Items to Sale",exact:true})});await picker.getByRole("button",{name:"Save",exact:true}).click();
  await page.getByLabel("Invoice site reference",{exact:true}).fill("SITE-ORIGINAL");await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page).toHaveURL(/\/sales\/[^/]+$/);
  const saleId=page.url().split("/").at(-1)!;
  expect((await db.customFieldValue.findFirstOrThrow({where:{companyId,entityId:saleId,definitionId:field.id}})).value).toBe("SITE-ORIGINAL");
  const printed=await page.request.get(`/api/account/print/SALES_INVOICE/${saleId}`);expect(printed.status()).toBe(200);expect(await printed.text()).toContain("SITE-ORIGINAL");
  await page.goto(`/workspace/account/sales/${saleId}/edit`);await expect(page.getByLabel("Invoice site reference",{exact:true})).toHaveValue("SITE-ORIGINAL");await page.getByLabel("Invoice site reference",{exact:true}).fill("SITE-REPLACEMENT");await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page).toHaveURL(/\/sales\/[^/]+$/);const replacementId=page.url().split("/").at(-1)!;expect(replacementId).not.toBe(saleId);
  expect((await db.customFieldValue.findFirstOrThrow({where:{companyId,entityId:saleId,definitionId:field.id}})).value).toBe("SITE-ORIGINAL");expect((await db.customFieldValue.findFirstOrThrow({where:{companyId,entityId:replacementId,definitionId:field.id}})).value).toBe("SITE-REPLACEMENT");
  const replacement=await mobileReplaceSale(principal,replacementId,{...payload,idempotencyKey:randomUUID()});expect((await db.customFieldValue.findFirstOrThrow({where:{companyId,entityId:replacement.id,definitionId:field.id}})).value).toBe("SITE-REPLACEMENT");
 }finally{await db.customFieldDefinition.update({where:{id:field.id},data:{isActive:false}});await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules,transactionDefaults:original.transactionDefaults??{}}})}
});

test("A089 purchase bill fields persist in the actual draft form and required rejection is atomic",async({page})=>{
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),field=await db.customFieldDefinition.create({data:{companyId,entityType:"PURCHASE_BILL",fieldKey:"supplier_site",label:"Supplier site reference",dataType:"TEXT",isRequired:true,validation:{showInPrint:true}}}),vendor=await db.vendor.create({data:{companyId,name:"Bill custom fields vendor"}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["PURCHASES"]}});
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Bill fields year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  const user=await db.user.findUniqueOrThrow({where:{id:userId}}),actor={...user,companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
  const before=await db.commercialDocument.count({where:{companyId}});
  await expect(createCommercialDocumentForActor(actor,{type:"PURCHASE_BILL",branchId,partyId:vendor.id,issueDate:"2026-10-11",vendorInvoiceNumber:"CF-1",vendorInvoiceDate:"2026-10-11",purchasePurpose:"GENERAL_OFFICE",lines:[{lineType:"CUSTOM",itemName:"Custom bill material",quantity:"1",rate:"100",taxRate:"0"}]})).rejects.toThrow("CUSTOM_FIELDS_REQUIRED");expect(await db.commercialDocument.count({where:{companyId}})).toBe(before);
  await signInSettings(page);await page.goto("/workspace/account/transactions/new?type=PURCHASE_BILL");await page.getByText("Advanced purchase purpose",{exact:true}).click();await page.getByRole("combobox",{name:/^Purpose/}).selectOption("GENERAL_OFFICE");await page.getByRole("combobox",{name:/^Vendor/}).selectOption(vendor.id);await page.getByLabel("Vendor invoice number",{exact:true}).fill("CF-1");await page.getByLabel("Vendor invoice date",{exact:true}).fill("2026-10-11");await page.getByLabel("Name",{exact:true}).fill("Custom bill material");await page.getByLabel("Rate",{exact:true}).fill("100");await page.getByLabel("Supplier site reference",{exact:true}).fill("SUPPLIER-SITE-1");await page.getByRole("button",{name:"Create Draft",exact:true}).click();await expect(page).toHaveURL(/\/transactions\/[a-f0-9-]+$/);
  const id=page.url().split("/").at(-1)!;expect((await db.customFieldValue.findFirstOrThrow({where:{companyId,entityId:id,definitionId:field.id}})).value).toBe("SUPPLIER-SITE-1");const printed=await page.request.get(`/api/account/print/PURCHASE_BILL/${id}`);expect(printed.status()).toBe(200);expect(await printed.text()).toContain("SUPPLIER-SITE-1");
 }finally{await db.customFieldDefinition.update({where:{id:field.id},data:{isActive:false}});await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules}})}
});

test("A089 quotation fields reopen and stay with their own revision and public PDF",async({page})=>{
 test.setTimeout(90000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),field=await db.customFieldDefinition.create({data:{companyId,entityType:"QUOTATION",fieldKey:"quote_site",label:"Quotation site reference",dataType:"TEXT",isRequired:true}}),privateField=await db.customFieldDefinition.create({data:{companyId,entityType:"QUOTATION",fieldKey:"private_quote_note",label:"Private quotation note",dataType:"TEXT",isRequired:false}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["QUOTATIONS_BOQ"]}});
  const user=await db.user.findUniqueOrThrow({where:{id:userId}}),actor={...user,companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]},input={branchId,customerId,documentType:"QUOTATION",issueDate:"2026-10-11",validUntil:"2026-11-11",lines:[{lineType:"CUSTOM",itemName:"Quotation custom field line",quantity:"2",rate:"100",taxRate:"0",discountType:"FIXED",discountValue:"10",unitName:"Square feet",unitSymbol:"sqft",specification:"Retain finish A",internalUnitCost:"25"}],adjustments:[{type:"ADDITIONAL_CHARGE",label:"Delivery",valueType:"FIXED",value:"20",taxable:false,taxRate:"0"}],paymentSchedule:[{label:"Advance",valueType:"PERCENTAGE",value:"100",dueDescription:"Before work"}]};
  const before=await db.quotationDocument.count({where:{companyId}});await expect(createQuotationForActor(actor,input)).rejects.toThrow("CUSTOM_FIELDS_REQUIRED");expect(await db.quotationDocument.count({where:{companyId}})).toBe(before);
  await signInSettings(page);await page.goto("/workspace/account/settings/custom-fields");const definitionRow=page.locator(".account-list > div").filter({has:page.getByText("Quotation site reference",{exact:true})});await definitionRow.getByText("Edit field",{exact:true}).click();await definitionRow.getByLabel("Show in print",{exact:true}).check();await definitionRow.getByRole("button",{name:"Save field",exact:true}).click();await expect.poll(()=>db.customFieldDefinition.findUniqueOrThrow({where:{id:field.id}}).then(row=>(row.validation as {showInPrint?:boolean}|null)?.showInPrint)).toBe(true);
  const quote=await createQuotationForActor(actor,{...input,customFields:{quote_site:"QUOTE-ORIGINAL",private_quote_note:"INTERNAL-DO-NOT-SHARE"}});
  await signInSettings(page);await page.goto(`/workspace/account/quotations/${quote.id}/edit`);await expect(page.getByLabel("Quotation site reference",{exact:true})).toHaveValue("QUOTE-ORIGINAL");await expect(page.getByLabel("Issue date",{exact:true})).toHaveValue("2026-10-11");await expect(page.getByLabel("Valid until",{exact:true})).toHaveValue("2026-11-11");await page.getByLabel("Quotation site reference",{exact:true}).fill("QUOTE-EDITED");await page.getByRole("button",{name:"Save draft",exact:true}).click();await expect(page).toHaveURL(new RegExp(`/quotations/${quote.id}\\?saved=1$`));
  let document=await getQuotationForActor(actor,quote.id);const originalRevision=document.revisions[0].id;
  expect(document.revisions[0].customFields.quote_site).toBe("QUOTE-EDITED");
  const pdf=await page.request.get(`/workspace/account/quotations/${quote.id}/pdf`);expect(pdf.status()).toBe(200);expect((await pdf.body()).toString()).toContain("QUOTE-EDITED");expect((await pdf.body()).toString()).not.toContain("INTERNAL-DO-NOT-SHARE");
  await transitionQuotationForActor(actor,quote.id,"PENDING_APPROVAL");await transitionQuotationForActor(actor,quote.id,"APPROVED");
  const shared=await createQuotationShareForActor(actor,quote.id);const token=shared;
  const publicQuote=await getPublicQuotation(token);expect(publicQuote.customFields).toEqual([{label:"Quotation site reference",value:"QUOTE-EDITED"}]);expect(JSON.stringify(publicQuote)).not.toContain("INTERNAL-DO-NOT-SHARE");
  await page.goto(`/workspace/account/quotations/${quote.id}/revisions/new`);await expect(page.getByLabel("Issue date",{exact:true})).toHaveValue("2026-10-11");await expect(page.getByLabel("Valid until",{exact:true})).toHaveValue("2026-11-11");
  await expect(page.getByRole("combobox",{name:/^Type/})).toBeDisabled();await expect(page.getByRole("combobox",{name:/^Branch/})).toBeDisabled();await expect(page.getByRole("combobox",{name:/^Customer/})).toBeDisabled();
  await page.getByRole("button",{name:"Save draft",exact:true}).click();await expect(page).toHaveURL(new RegExp(`/quotations/${quote.id}\\?revised=1$`));
  document=await getQuotationForActor(actor,quote.id);
  expect(document.revisions[0].lines[0].quantity.toString()).toBe("2");expect(document.revisions[0].lines[0].rate.toString()).toBe("100");expect((await db.quotationLine.findUniqueOrThrow({where:{id:document.revisions[0].lines[0].id}})).internalUnitCost.toString()).toBe("25");expect(document.revisions[0].lines[0].unitSymbol).toBe("sqft");expect(document.revisions[0].lines[0].specification).toBe("Retain finish A");
  expect(document.revisions[0].adjustments[0].value.toString()).toBe("20");expect(document.revisions[0].paymentSchedule[0].value.toString()).toBe("100");
  await expect(createQuotationRevisionForActor(actor,quote.id,input)).rejects.toThrow("REVISION_NOT_ALLOWED");
  await expect(getQuotationForActor({...actor,companyId:otherCompanyId},quote.id)).rejects.toThrow("NOT_FOUND");expect(document.revisions[0].customFields.quote_site).toBe("QUOTE-EDITED");expect(document.revisions[0].id).not.toBe(originalRevision);expect(document.revisions[1].customFields.quote_site).toBe("QUOTE-EDITED");
  await page.goto(`/workspace/account/quotations/${quote.id}/edit`);await page.getByLabel("Quotation site reference",{exact:true}).fill("QUOTE-REVISION-1");await page.getByRole("button",{name:"Save draft",exact:true}).click();await expect(page).toHaveURL(new RegExp(`/quotations/${quote.id}\\?saved=1$`));document=await getQuotationForActor(actor,quote.id);expect(document.revisions[0].customFields.quote_site).toBe("QUOTE-REVISION-1");expect(document.revisions[1].customFields.quote_site).toBe("QUOTE-EDITED");expect((await getPublicQuotation(token)).customFields).toEqual([{label:"Quotation site reference",value:"QUOTE-EDITED"}]);
 }finally{await page.goto("/workspace/account");await db.customFieldDefinition.updateMany({where:{id:{in:[field.id,privateField.id]}},data:{isActive:false}});await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules}})}
});

test("A072 costing groups preserve scope final-state rules and saved display preferences", async ({page}) => {
  test.setTimeout(90000);
  const original = await db.accountSettings.findUniqueOrThrow({where:{companyId}});
  try {
    await db.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS","PROJECT_COSTING"],baseCurrency:"USD",displayDecimalPlaces:3}});
    const user = await db.user.findUniqueOrThrow({where:{id:userId}});
    const actor = {...user,companyId,branchIds:[]} as ProjectActor;
    const project = await createSimpleProjectForActor(actor,{name:"A072 costing audit",branchId,projectValue:"123.45"});
    const {loadProjectCostingForActor,createChangeOrderForActor} = await import("../src/lib/account/project-costing");
    const costing = await loadProjectCostingForActor(actor,project.id);
    expect(costing.metrics.contractRevenueBase.toString()).toBe("123.45");
    expect(costing.metrics.finalProfit).toBeNull();
    await expect(loadProjectCostingForActor({...actor,companyId:otherCompanyId},project.id)).rejects.toThrow();
    await signInSettings(page);
    await page.goto(`/workspace/account/projects/${project.id}/costing`);
    for (const title of ["Contract and revenue","Costs and materials","Payments and outstanding","Profit"])
      await expect(page.getByRole("heading",{name:title,exact:true})).toBeVisible();
    await expect(page.getByText("Final Profit",{exact:true})).toHaveCount(0);
    await expect(page.getByRole("region",{name:"Contract and revenue",exact:true})).toContainText("$123.450");
    await expect(page.getByRole("region",{name:"Profit",exact:true})).toContainText("0.00%");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.getByText("Additional work/package analysis",{exact:true}).click();
    // Unassigned work may be represented by a synthetic row; the section must remain usable.
    await expect(page.getByRole("heading",{name:"Work / Package Profitability",exact:true})).toBeVisible();
    await db.project.update({where:{id:project.id},data:{status:"CLOSED"}});
    await expect(createChangeOrderForActor(actor,{projectId:project.id,title:"Must not edit final project",valueDelta:"1",estimatedCostDelta:"0"})).rejects.toThrow("PROJECT_FINAL");
    await page.reload();
    await expect(page.getByText("Final Profit",{exact:true})).toBeVisible();
    await db.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS"]}});
    await expect(loadProjectCostingForActor(actor,project.id)).rejects.toThrow();
  } finally {
    await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules,baseCurrency:original.baseCurrency,displayDecimalPlaces:original.displayDecimalPlaces}});
  }
});

test("A073 project edits retain rejected input and A076 A078 navigation lands correctly",async({page})=>{
 test.setTimeout(90000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try {
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS","PROJECT_COSTING","INVENTORY"]}});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
  const project=await createSimpleProjectForActor(actor,{name:"Project edit audit",branchId,projectValue:"100"});
  await signInSettings(page);await page.goto(`/workspace/account/projects/${project.id}/edit`);
  await expect(page.getByRole("combobox",{name:"Status",exact:true})).toBeVisible();
  expect(await page.getByRole("combobox",{name:"Status",exact:true}).locator("option").allTextContents()).toEqual(["Active","Hold"]);
  await page.getByLabel("Project name",{exact:true}).fill("Retained project name");
  await page.getByLabel("Project value",{exact:true}).fill("-1");
  await page.getByRole("button",{name:"Save project",exact:true}).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page.getByLabel("Project name",{exact:true})).toHaveValue("Retained project name");
  expect((await db.project.findUniqueOrThrow({where:{id:project.id}})).projectValue.toString()).toBe("100");
  await page.getByLabel("Project value",{exact:true}).fill("200");
  await page.getByRole("combobox",{name:"Status",exact:true}).selectOption("ON_HOLD");
  await page.getByRole("button",{name:"Save project",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
  expect((await db.project.findUniqueOrThrow({where:{id:project.id}})).status).toBe("ON_HOLD");
  await page.goto(`/workspace/account/projects/material?projectId=${project.id}`);
  await expect(page.getByRole("heading",{name:"Project Material",exact:true})).toBeVisible();
  await page.locator(`a[href="/workspace/account/projects/${project.id}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
  await page.goto("/workspace/account/projects");
  await page.getByRole("link",{name:"Project Actions",exact:true}).click();
  await expect(page).toHaveURL(/\/projects\/actions$/);
  await expect(page.getByRole("heading",{name:"Project Actions",exact:true})).toBeVisible();
  await db.project.update({where:{id:project.id},data:{status:"CLOSED"}});
  await page.goto(`/workspace/account/projects/${project.id}/edit`);
  await expect(page.getByText("This project is completed and report-only. It cannot be reopened or edited.",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Save project",exact:true})).toHaveCount(0);
 }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules}})}
});

test("A074 project detail closes once with final billing and preserves scoped history",async({page})=>{
 test.setTimeout(90000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try {
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS","PROJECT_COSTING","SALES"],baseCurrency:"USD",displayDecimalPlaces:3}});
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Project closure audit year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
  const project=await createSimpleProjectForActor(actor,{name:"A074 final billing audit",branchId,projectValue:"100"});
  const {closeAndBillProjectForActor}=await import("../src/lib/account/project-close");
  await expect(closeAndBillProjectForActor(actor,project.id,{})).rejects.toThrow("PROJECT_FINAL_INVOICE_SERVICE_REQUIRED");
  expect((await db.project.findUniqueOrThrow({where:{id:project.id}})).status).toBe("ACTIVE");
  expect(await db.commercialDocument.count({where:{companyId,projectId:project.id}})).toBe(0);
  const service=await db.accountService.create({data:{companyId,name:"Project final billing service",sellingRate:"100",taxRate:"0"}});
  await signInSettings(page);await page.goto(`/workspace/account/projects/${project.id}`);
  await expect(page.locator("article").filter({has:page.getByText("Project value",{exact:true})})).toContainText("$100.000");
  await page.getByRole("combobox",{name:"Final invoice service / SAC",exact:true}).selectOption(service.id);
  await page.getByRole("button",{name:"Complete project",exact:true}).click();
  await expect.poll(async()=>(await db.project.findUniqueOrThrow({where:{id:project.id}})).status).toBe("CLOSED");
  const invoice=await db.commercialDocument.findFirstOrThrow({where:{companyId,projectId:project.id,type:"SALES_INVOICE",status:"POSTED"}});
  expect(invoice.taxableTotal.toString()).toBe("100");
  expect((await closeAndBillProjectForActor(actor,project.id,{})).alreadyClosed).toBe(true);
  expect(await db.commercialDocument.count({where:{companyId,projectId:project.id,type:"SALES_INVOICE"}})).toBe(1);
  await expect(closeAndBillProjectForActor({...actor,companyId:otherCompanyId},project.id,{})).rejects.toThrow();
  await page.reload();await expect(page.getByRole("button",{name:"Complete project",exact:true})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Edit project",exact:true})).toHaveCount(0);
 }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules,baseCurrency:original.baseCurrency,displayDecimalPlaces:original.displayDecimalPlaces}})}
});

test("A075 actions require a mutable scoped project and honor costing module visibility",async({page})=>{
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS","PROJECT_COSTING"]}});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
  const project=await createSimpleProjectForActor(actor,{name:"Action hub audit",branchId,projectValue:"0"});
  await signInSettings(page);await page.goto("/workspace/account/projects/actions");
  await expect(page.getByRole("heading",{name:"Project Actions",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Extra job",exact:true})).toHaveCount(0);
  await page.getByRole("combobox",{name:"Project",exact:true}).selectOption(project.id);
  await page.getByRole("button",{name:"Continue",exact:true}).click();
  await expect(page.getByRole("link",{name:"Extra job",exact:true})).toHaveAttribute("href",`/workspace/account/projects/${project.id}/costing`);
  await page.getByRole("link",{name:"Profit / loss",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/costing#report$`));
  await expect(page.locator("#report")).toBeVisible();
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS"]}});
  await page.goto(`/workspace/account/projects/actions?projectId=${project.id}`);
  await expect(page.getByRole("heading",{name:"Project Actions",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Extra job",exact:true})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Profit / loss",exact:true})).toHaveCount(0);
  await db.project.update({where:{id:project.id},data:{status:"CLOSED"}});
  await page.reload();await expect(page.getByRole("combobox",{name:"Project",exact:true})).toHaveValue("");
  await expect(page.getByRole("link",{name:"Close Project",exact:true})).toHaveCount(0);
 }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules}})}
});

test("A076 material posting retains original cost rejects excess and safely reuses requests",async({page})=>{
 test.setTimeout(90000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS","PROJECT_COSTING","INVENTORY"],baseCurrency:"USD",displayDecimalPlaces:3,dateFormat:"YYYY-MM-DD"}});
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Material audit year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
  const project=await createSimpleProjectForActor(actor,{name:"Material source project",branchId,projectValue:"0"});
  const destination=await createSimpleProjectForActor(actor,{name:"Material destination project",branchId,projectValue:"0"});
  const product=await db.accountProduct.create({data:{companyId,name:"Original cost audit material",trackInventory:true,costPrice:"30",salePrice:"100",taxRate:"0"}});
  const warehouse=await db.warehouse.create({data:{companyId,branchId,name:"Material audit warehouse",code:"A076",isDefault:true}});
  await createStockMovementForActor(actor,"OPENING",{warehouseId:warehouse.id,productId:product.id,quantity:"5",unitCost:"30",movementDate:"2026-10-10",sourceType:"OPENING",sourceId:randomUUID()});
  const {issueInventoryToProjectForActor,consumeProjectMaterialForActor,transferProjectMaterialForActor,returnProjectMaterialForActor,projectMaterialContextForActor}=await import("../src/lib/account/project-material-service");
  const issueInput={projectId:project.id,warehouseId:warehouse.id,productId:product.id,quantity:"3",movementDate:"2026-10-11",idempotencyKey:randomUUID()};
  const issue=await issueInventoryToProjectForActor(actor,issueInput);
  expect(issue.originalUnitCost.toString()).toBe("30");expect(issue.totalCost.toString()).toBe("90");
  const backup=JSON.parse(Buffer.from((await createAccountBackupForActor(actor)).bytes).toString());
  expect(backup.data.projectMaterialMovement).toEqual(expect.arrayContaining([expect.objectContaining({id:issue.id,companyId,projectId:project.id,originalUnitCost:"30",totalCost:"90"})]));
  expect(backup.manifest.recordCounts.projectMaterialMovement).toBe(backup.data.projectMaterialMovement.length);
  expect((await issueInventoryToProjectForActor(actor,issueInput)).id).toBe(issue.id);
  await expect(issueInventoryToProjectForActor(actor,{...issueInput,quantity:"2"})).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
  await signInSettings(page);await page.goto(`/workspace/account/projects/material?projectId=${project.id}`);
  await page.getByRole("combobox",{name:"Action",exact:true}).selectOption("CONSUME");
  await page.getByRole("combobox",{name:"Original material",exact:true}).selectOption(issue.id);
  await expect(page.getByRole("combobox",{name:"Original material",exact:true})).toContainText("$30.000/unit");
  await expect(page.getByRole("heading",{name:"Movement history",exact:true}).locator("..")).toContainText("$90.000");
  await page.getByRole("spinbutton",{name:"Quantity",exact:true}).fill("4");
  // Bypass the browser max solely to verify the independent server availability guard.
  await page.getByRole("spinbutton",{name:"Quantity",exact:true}).evaluate(input=>input.removeAttribute("max"));
  await page.getByRole("button",{name:"Post movement",exact:true}).click();await expect(page.locator("form p[role=alert]")).toContainText("available");
  await expect(page.getByRole("spinbutton",{name:"Quantity",exact:true})).toHaveValue("4");
  expect(await db.projectMaterialMovement.count({where:{companyId,projectId:project.id,movementType:"CONSUMPTION"}})).toBe(0);
  await page.getByRole("spinbutton",{name:"Quantity",exact:true}).fill("1");
  await page.getByRole("button",{name:"Post movement",exact:true}).click();
  await expect.poll(()=>db.projectMaterialMovement.count({where:{companyId,projectId:project.id,movementType:"CONSUMPTION"}})).toBe(1);
  const transferInput={sourceProjectId:project.id,destinationProjectId:destination.id,sourceMovementId:issue.id,quantity:"1",movementDate:"2026-10-11",reason:"Move leftover material",idempotencyKey:randomUUID()};
  await transferProjectMaterialForActor(actor,transferInput);await transferProjectMaterialForActor(actor,transferInput);
  const incoming=await db.projectMaterialMovement.findFirstOrThrow({where:{companyId,projectId:destination.id,movementType:"TRANSFER_IN"}});
  expect(incoming.originalUnitCost.toString()).toBe("30");expect(incoming.totalCost.toString()).toBe("30");
  expect(await db.projectMaterialMovement.count({where:{companyId,projectId:destination.id,movementType:"TRANSFER_IN"}})).toBe(1);
  const returned=await returnProjectMaterialForActor(actor,{projectId:project.id,sourceMovementId:issue.id,warehouseId:warehouse.id,quantity:"1",movementDate:"2026-10-11",reason:"Return leftover",idempotencyKey:randomUUID()});expect(returned.totalCost.toString()).toBe("30");
  const context=await projectMaterialContextForActor(actor,{projectId:project.id});
  expect(context.sources.find(row=>row.id===issue.id)?.availableQuantity.toString()).toBe("0");
  await expect(consumeProjectMaterialForActor({...actor,companyId:otherCompanyId},{projectId:project.id,sourceMovementId:issue.id,quantity:"1",movementDate:"2026-10-11",idempotencyKey:randomUUID()})).rejects.toThrow();
 }finally{await page.goto("/workspace/account");await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules,baseCurrency:original.baseCurrency,displayDecimalPlaces:original.displayDecimalPlaces,dateFormat:original.dateFormat}})}
});


test("A078 project dashboard renders empty state totals statuses and module-aware shortcuts",async({page})=>{
 test.setTimeout(90000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS"],baseCurrency:"USD",displayDecimalPlaces:3}});
  await signInSettings(page);await page.goto("/workspace/account/projects");
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
  const before=await projectDashboardForActor(actor);
  if(before.rows.length===0)await expect(page.getByText("No projects found.",{exact:true})).toBeVisible();
  // Sales is a core capability even when absent from legacy stored module arrays.
  await expect(page.getByRole("link",{name:"Project Invoice",exact:true})).toHaveCount(1);
  await expect(page.getByRole("link",{name:"Project Actions",exact:true})).toHaveAttribute("href","/workspace/account/projects/actions");
  const active=await createSimpleProjectForActor(actor,{name:"A078 active project",branchId,projectValue:"100"});
  const closed=await createSimpleProjectForActor(actor,{name:"A078 closed project",branchId,projectValue:"200"});
  const cancelled=await createSimpleProjectForActor(actor,{name:"A078 cancelled project",branchId,projectValue:"300"});
  await db.project.update({where:{id:closed.id},data:{status:"CLOSED"}});
  await db.project.update({where:{id:cancelled.id},data:{status:"CANCELLED"}});
  const dashboard=await projectDashboardForActor(actor);
  expect(dashboard.rows.map(row=>row.id).sort()).toEqual([...before.rows.map(row=>row.id),active.id,closed.id,cancelled.id].sort());
  expect(dashboard.metrics.activeProjects).toBe(before.metrics.activeProjects+1);expect(dashboard.metrics.projectsClosed).toBe(before.metrics.projectsClosed+1);
  expect(dashboard.metrics.totalProjectValue.toString()).toBe(before.metrics.totalProjectValue.add("600").toString());
  expect(dashboard.metrics.received.toString()).toBe(before.metrics.received.toString());expect(dashboard.metrics.outstanding.toString()).toBe(before.metrics.outstanding.toString());
  await page.reload();
  const summary=page.getByRole("region",{name:"Project summary"});
  await expect(summary.locator("article").filter({hasText:"Total Project Value"})).toContainText(`$${before.metrics.totalProjectValue.add("600").toFixed(3)}`);
  await expect(summary.locator("article").filter({hasText:"Active Projects"})).toContainText(String(before.metrics.activeProjects+1));
  await expect(summary.locator("article").filter({hasText:"Projects Closed"})).toContainText(String(before.metrics.projectsClosed+1));
  await expect(page.locator(`a[href="/workspace/account/projects/${closed.id}"]`)).toContainText("Closed");
  await page.locator(`a[href="/workspace/account/projects/${active.id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${active.id}$`));
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS","SALES"]}});
  await page.goto("/workspace/account/projects");
  await expect(page.getByRole("link",{name:"Project Invoice",exact:true})).toHaveAttribute("href","/workspace/account/transactions/new?type=SALES_INVOICE&project=select");
 }finally{
  await page.goto("/workspace/account");
  await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules,baseCurrency:original.baseCurrency,displayDecimalPlaces:original.displayDecimalPlaces}});
 }
});


test("A084 profit withdrawal separates drawings from investment and preserves dated reversals and exports",async({page})=>{
 test.setTimeout(90000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{baseCurrency:"INR",displayDecimalPlaces:2}});
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Withdrawal audit year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
  const owner=await setupOwnerFinancialAccountForActor(actor,userId,branchId);
  const ledger=await db.ledgerAccount.create({data:{companyId,code:`A084-${randomUUID().slice(0,8)}`,name:"Withdrawal test cash",accountClass:"ASSET",normalBalance:"DEBIT"}});
  const money=await db.moneyAccount.create({data:{companyId,branchId,name:"Withdrawal test cash",type:"CASH",ledgerAccountId:ledger.id}});
  await postOwnerTransactionForActor(actor,{ownerFinancialAccountId:owner.id,moneyAccountId:money.id,branchId,type:"INVESTMENT",amount:"200",transactionDate:"2026-10-10",reference:"Investment excluded",idempotencyKey:randomUUID()});
  const withdrawal=await postOwnerTransactionForActor(actor,{ownerFinancialAccountId:owner.id,moneyAccountId:money.id,branchId,type:"WITHDRAWAL",amount:"50",transactionDate:"2026-10-11",reference:"Owner withdrawal",idempotencyKey:randomUUID()});
  await reverseJournalForActor(actor,{journalEntryId:withdrawal.journalEntryId,entryDate:"2026-10-12",reason:"Withdrawal reversed for audit"});
  const before=await runFinancialReportForActor(actor,"profit-withdrawal",{from:"2026-10-01",to:"2026-10-11",scope:"all",branchId:"",projectId:"",customerId:"",vendorId:"",productId:"",ledgerId:""});
  expect(before.rows).toHaveLength(1);expect(before.totals?.[3]).toBe("50");expect(before.rows[0][4]).toBe("WITHDRAWAL");
  const after=await runFinancialReportForActor(actor,"profit-withdrawal",{from:"2026-10-01",to:"2026-10-12"});
  expect(after.rows).toHaveLength(2);expect(after.totals?.[3]).toBe("0");
  await signInSettings(page);await page.goto("/workspace/account/reports/profit-withdrawal?scope=all&from=2026-10-01&to=2026-10-11");
  await expect(page.getByRole("heading",{name:"Profit Withdrawal Report",exact:true})).toBeVisible();
  await expect(page.locator("main.employees-shell")).toContainText("withdrawals are not business expenses");
  await page.getByRole("button",{name:"Run report",exact:true}).click();
  await expect(page.locator("main.employees-shell")).not.toContainText("Invalid UUID");
  await expect(page.locator("table")).toContainText("Owner withdrawal");
  const csv=await page.request.get("/api/account/reports/profit-withdrawal/csv?scope=all&from=2026-10-01&to=2026-10-11");
  expect(csv.status()).toBe(200);const content=await csv.text();expect(content).toContain("Net withdrawals");expect(content).toContain("Scope:");expect(content).not.toContain("Investment excluded");
  const xlsx=await page.request.get("/api/account/reports/profit-withdrawal/xlsx?scope=all&from=2026-10-01&to=2026-10-11");
  expect(xlsx.status()).toBe(200);const book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await xlsx.body()).buffer);
  const values=JSON.stringify(book.worksheets[0].getSheetValues());expect(values).toContain("Net withdrawals");expect(values).toContain("Scope:");expect(values).toContain("Owner withdrawal");expect(values).not.toContain("Investment excluded");
  const pdf=await page.request.get("/api/account/reports/profit-withdrawal/pdf?scope=all&from=2026-10-01&to=2026-10-11");
  expect(pdf.status()).toBe(200);const pdfBytes=await pdf.body();expect((await PDFDocument.load(pdfBytes)).getPageCount()).toBeGreaterThan(0);
  expect(pdfBytes.toString()).toContain("Net withdrawals");expect(pdfBytes.toString()).toContain("Scope:");expect(pdfBytes.toString()).not.toContain("Investment excluded");
 }finally{await page.goto("/workspace/account");await db.accountSettings.update({where:{companyId},data:{baseCurrency:original.baseCurrency,displayDecimalPlaces:original.displayDecimalPlaces}})}
});


test("A086 shared Add Sale form restores invoice snapshots and saves edits or deletes atomically",async({page})=>{
 test.setTimeout(180000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),defaults=(original.transactionDefaults??{}) as import("@prisma/client").Prisma.JsonObject;
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["SALES"],transactionDefaults:{...defaults,transactionPreferences:{billingName:true,customerPoDetails:true,transactionTime:true,ewayBillNumber:true,termsEnabled:true,roundOff:true,invoicePreview:false,linkPayments:false}}}});
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Sale edit audit year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
  const customer=await db.customer.create({data:{companyId,branchId,name:"A086 saved customer",isAccountCustomer:true,stateCode:"29"}});
  const service=await db.accountService.create({data:{companyId,name:"A086 saved service",sellingRate:"120",taxRate:"18"}});
  const draft=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",branchId,partyId:customer.id,issueDate:"2026-10-10",dueDate:"2026-10-20",billingName:"Original billing site",customerPoNumber:"PO-17",customerPoDate:"2026-10-09",transactionTime:"10:15",ewayBillNumber:"123456789012",taxMode:"INCLUSIVE",stateOfSupplyCode:"29",freightAmount:"5",otherChargesAmount:"7",roundOffAmount:"0.25",notes:"Original saved terms",lines:[{lineType:"SERVICE",sourceId:service.id,quantity:"1",rate:"120",taxRate:"18",cessRate:"2",unitName:"Saved unit",unitSymbol:"Su",description:"Original item description",specification:"Saved specification"}]});
  await postCommercialDocumentForActor(actor,{documentId:draft.id});
  await signInSettings(page);await page.goto(`/workspace/account/sales/${draft.id}/edit`);
  await expect(page.getByRole("heading",{name:"Sale",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Delete",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Save & New",exact:true})).toHaveCount(0);
  await expect(page.locator("main").last()).toContainText(draft.documentNumber);await expect(page.getByPlaceholder("Search customer name or phone")).toHaveValue(customer.name);await expect(page.getByPlaceholder("Billing Name(Optional)")).toHaveValue("Original billing site");await expect(page.getByLabel("Customer PO Number",{exact:true})).toHaveValue("PO-17");await expect(page.getByLabel("Transaction Time",{exact:true})).toHaveValue("10:15");
  await expect(page.locator("main").last()).toContainText("132.25");await expect(page.getByLabel("State of Supply",{exact:true})).toHaveValue("29");
  await page.getByText("Terms & Conditions",{exact:true}).click();await expect(page.getByLabel("Terms & Conditions",{exact:true})).toHaveValue("Original saved terms");await page.getByLabel("Terms & Conditions",{exact:true}).fill("Updated saved terms");
  await page.getByRole("button",{name:`Edit item ${service.name}`,exact:true}).click();await expect(page.getByLabel("Rate (Price/Unit)",{exact:true})).toHaveValue("120");await page.getByLabel("Quantity",{exact:true}).fill("2");await page.locator("section").filter({has:page.getByRole("heading",{name:"Add Items to Sale",exact:true})}).getByRole("button",{name:"Save",exact:true}).click();await page.getByRole("button",{name:"Save",exact:true}).click();
  await expect(page).toHaveURL(/\/workspace\/account\/sales\/[a-f0-9-]+$/,{timeout:20000});let replacementId=page.url().split("/").at(-1)!;expect(replacementId).not.toBe(draft.id);
  const replacement=await db.commercialDocument.findUniqueOrThrow({where:{id:replacementId},include:{lines:true}});expect(replacement.grandTotal.toString()).toBe("252.25");expect(replacement.notes).toBe("Updated saved terms");expect(replacement.billingName).toBe("Original billing site");expect(replacement.customerPoNumber).toBe("PO-17");expect(replacement.freightAmount.toString()).toBe("5");expect(replacement.otherChargesAmount.toString()).toBe("7");expect(replacement.roundOffAmount.toString()).toBe("0.25");expect(replacement.dueDate?.toISOString().slice(0,10)).toBe("2026-10-20");expect(replacement.lines[0]).toMatchObject({unitName:"Saved unit",unitSymbol:"Su",specification:"Saved specification",description:"Original item description"});expect(replacement.lines[0].cessRate.toString()).toBe("2");
  expect((await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,draft.id))).outstanding.toString()).toBe("0");
  const principal={...actor,productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const]};
  const retained=await mobileReplaceSale(principal,replacementId,{idempotencyKey:randomUUID(),branchId,partyId:customer.id,issueDate:"2026-10-10",lines:[{originalLineId:replacement.lines[0].id,lineType:"SERVICE",sourceId:service.id,quantity:"2",rate:"120",taxRate:"18",cessRate:"2"}]});replacementId=retained.id;
  const retainedRow=await db.commercialDocument.findUniqueOrThrow({where:{id:replacementId}});expect(retainedRow).toMatchObject({billingName:"Original billing site",customerPoNumber:"PO-17",transactionTime:"10:15",ewayBillNumber:"123456789012",notes:"Updated saved terms"});expect(retainedRow.dueDate?.toISOString().slice(0,10)).toBe("2026-10-20");expect(retainedRow.grandTotal.toString()).toBe("252.25");const retainedLine=await db.commercialDocumentLine.findFirstOrThrow({where:{documentId:replacementId}});expect(retainedLine).toMatchObject({unitName:"Saved unit",unitSymbol:"Su",specification:"Saved specification",description:"Original item description"});
  await page.goto(`/workspace/account/sales/${draft.id}`,{waitUntil:"domcontentloaded"});const adjusted=page.locator("main").last();await expect(adjusted.locator("div").filter({has:page.getByText("Received",{exact:true})}).last()).toHaveText(/Received₹0\.00/);await expect(adjusted.locator("div").filter({has:page.getByText("Credit adjustments",{exact:true})}).last()).toHaveText(/Credit adjustments₹132\.25/);await expect(adjusted.locator("div").filter({has:page.getByText("Balance Due",{exact:true})}).last()).toHaveText(/Balance Due₹0\.00/);
  await page.goto(`/workspace/account/sales/${replacementId}/edit`,{waitUntil:"domcontentloaded"});page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Delete",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/account$/);expect((await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,replacementId))).outstanding.toString()).toBe("0");expect(await db.commercialDocument.count({where:{companyId,sourceDocumentId:replacementId,type:"CREDIT_NOTE",status:"POSTED"}})).toBe(1);
 }finally{await page.goto("/workspace/account");await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules,transactionDefaults:original.transactionDefaults??{}}})}
});

test("A087 cancelled Sale Details shows status instead of an unpaid invoice balance",async({page})=>{
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["SALES"],displayDecimalPlaces:2}});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
  const cancelled=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",branchId,partyId:customerId,issueDate:"2026-10-11",lines:[{lineType:"CUSTOM",itemName:"A087 cancelled fixture",quantity:"1",rate:"100",taxRate:"0"}]});
  await db.commercialDocument.update({where:{id:cancelled.id},data:{status:"CANCELLED"}});
  await signInSettings(page);await page.goto(`/workspace/account/sales/${cancelled.id}`);const detail=page.locator("main").last();
  await expect(detail).toContainText("Invoice status: CANCELLED. No posted balance is due.");
  await expect(detail.locator("div").filter({has:page.getByText("Received",{exact:true})}).last()).toHaveText(/Received₹0\.00/);
  await expect(detail.locator("div").filter({has:page.getByText("Balance Due",{exact:true})}).last()).toHaveText(/Balance Due₹0\.00/);
  await expect(page.getByRole("button",{name:"Delete",exact:true})).toBeDisabled();await expect(page.getByRole("link",{name:"Edit",exact:true})).toHaveCount(0);
 }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules,displayDecimalPlaces:original.displayDecimalPlaces}})}
});

test("A089 definition editor creates Decimal fields and saves required print and active settings",async({page})=>{
 test.setTimeout(60000);
 await signInSettings(page);await page.goto("/workspace/account/settings/custom-fields");await expect(page.getByRole("heading",{name:"Custom fields",exact:true})).toBeVisible();const form=page.locator("form.account-form").first(),key=`decimal_${randomUUID().replaceAll("-","").slice(0,12)}`;
 await form.getByLabel("Entity",{exact:true}).selectOption("SALES_INVOICE");await form.getByLabel("Key",{exact:true}).fill(key);await form.getByLabel("Label",{exact:true}).fill("A089 decimal editor check");await form.getByLabel("Type",{exact:true}).selectOption("DECIMAL");await form.getByLabel("Position",{exact:true}).fill("9");await form.getByLabel("Required",{exact:true}).check();await form.getByLabel("Show in print",{exact:true}).check();await form.getByRole("button",{name:"Create field",exact:true}).click();
 await expect(form.getByText("Saved successfully",{exact:true})).toBeVisible();const created=await db.customFieldDefinition.findFirstOrThrow({where:{companyId,fieldKey:key}});expect(created).toMatchObject({dataType:"DECIMAL",isRequired:true,position:9,validation:{showInPrint:true}});
 const row=page.locator(".account-list > div").filter({hasText:key});await row.getByText("Edit field",{exact:true}).click();await row.getByLabel("Label",{exact:true}).fill("A089 decimal saved label");await row.getByLabel("Required",{exact:true}).uncheck();await row.getByLabel("Show in print",{exact:true}).uncheck();await row.getByLabel("Status",{exact:true}).selectOption("false");await row.getByRole("button",{name:"Save field",exact:true}).click();await expect(row.getByText("Saved successfully",{exact:true})).toBeVisible();
 expect(await db.customFieldDefinition.findUniqueOrThrow({where:{id:created.id}})).toMatchObject({label:"A089 decimal saved label",dataType:"DECIMAL",isRequired:false,isActive:false,validation:{showInPrint:false}});await page.reload();await expect(page.locator(".account-list > div").filter({hasText:key})).toContainText("INACTIVE");
});

test("A061 stock summary retains inactive history and scoped exports with strict dates",async({page})=>{
 test.setTimeout(120000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["INVENTORY"],itemSettings:{...(original.itemSettings as object??{}),enabled:true}}});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
  const warehouse=await db.warehouse.create({data:{companyId,branchId,name:"Stock summary history",code:`SUM-${randomUUID().slice(0,8)}`}});
  const product=await db.accountProduct.create({data:{companyId,name:"A061 archived stock",trackInventory:true,costPrice:"10",lowStockThreshold:"2"}});
  await createStockMovementForActor(actor,"OPENING",{warehouseId:warehouse.id,productId:product.id,quantity:"1.25",unitCost:"10",movementDate:"2026-10-10",sourceType:"OPENING",sourceId:randomUUID()});
  await db.accountProduct.update({where:{id:product.id},data:{isActive:false}});
  const principal={...actor,productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const]};
  const native=await mobileStockSummary(principal,{branchId,asOf:"2026-10-10",q:product.name,status:"false"});expect(native.filtered).toHaveLength(1);expect(native.filtered[0]).toMatchObject({id:product.id,quantity:"1.25",value:"12.5",active:false});
  expect((await PDFDocument.load(await mobileStockSummaryExport(principal,{branchId,asOf:"2026-10-10",q:product.name,status:"false"},"pdf"))).getPageCount()).toBeGreaterThan(0);
  await expect(mobileStockSummary({...principal,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},{branchId})).rejects.toThrow();
  await expect(mobileStockSummary({...principal,companyId:otherCompanyId},{branchId})).rejects.toThrow();

  await signInSettings(page);await page.goto(`/workspace/account/inventory/stock-summary?branchId=${branchId}&asOf=2026-10-10`);
  await page.getByRole("button",{name:"Filters",exact:true}).click();expect((await new AxeBuilder({page}).include(".account-stock-summary").analyze()).violations).toEqual([]);await page.getByRole("combobox",{name:"Item status"}).selectOption("false");await page.getByRole("button",{name:"Apply filters",exact:true}).click();await page.getByRole("textbox",{name:"Search stock"}).fill(product.name);
  const card=page.locator("article.account-item-card").filter({has:page.getByRole("heading",{name:product.name,exact:true})});
  await expect(card).toContainText("1.25");await expect(card).toContainText("12.50");
  const href=await page.getByRole("link",{name:"Download stock summary Excel workbook"}).getAttribute("href");expect(href).toContain(`branchId=${branchId}`);
  await page.getByRole("button",{name:"Filters",exact:true}).click();await page.getByRole("combobox",{name:"Item status"}).selectOption("true");await page.keyboard.press("Escape");expect(await page.getByRole("link",{name:"Download stock summary Excel workbook"}).getAttribute("href")).toContain("status=false");

  const response=await page.request.get(href!);expect(response.status()).toBe(200);const book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await response.body()).buffer);expect(book.worksheets[0].getSheetValues().flat().join(" ")).toContain(product.name);expect(book.worksheets[0].getCell("D7").value).toBe("12.50");
  for(const decimals of [0,1,2,3,4]){await db.accountSettings.update({where:{companyId},data:{displayDecimalPlaces:decimals}});await page.reload();await expect(card.locator("dl div").filter({has:page.getByText("Stock quantity",{exact:true})}).locator("dd")).toHaveText(decimals===0?"1":decimals===1?"1.3":(1.25).toFixed(decimals));const formatted=await page.request.get(href!);const precisionBook=new ExcelJS.Workbook();await precisionBook.xlsx.load(new Uint8Array(await formatted.body()).buffer);expect(precisionBook.worksheets[0].getCell("C7").value).toBe((decimals===0?"1":decimals===1?"1.3":(1.25).toFixed(decimals)));expect(precisionBook.worksheets[0].getCell("D7").value).toBe((decimals===0?"13":(12.5).toFixed(decimals)));}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const pdfHref=await page.getByRole("link",{name:"Download stock summary PDF"}).getAttribute("href");const pdf=await page.request.get(pdfHref!);expect(pdf.status()).toBe(200);expect((await pdf.body()).toString()).toContain("Branch:");
  expect((await page.request.get("/api/account/inventory/stock-summary/xlsx?asOf=2026-02-30")).status()).toBe(400);
  expect((await page.request.get(`/api/account/inventory/stock-summary/xlsx?branchId=${randomUUID()}`)).status()).toBe(403);
  await page.getByRole("textbox",{name:"Search stock"}).fill(product.name);
  await page.evaluate(()=>{Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>true});Object.defineProperty(navigator,"share",{configurable:true,value:async()=>{throw new DOMException("Cancelled","AbortError")}})});await page.getByRole("button",{name:"Share report",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Sharing cancelled."})).toBeVisible();
  await page.evaluate(()=>{Object.defineProperty(navigator,"share",{configurable:true,value:async(data:ShareData)=>{Object.defineProperty(window,"stockSharedPdf",{configurable:true,value:await data.files![0].text()})}})});await page.getByRole("button",{name:"Share report",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Report handed"})).toBeVisible();expect(await page.evaluate(()=>(window as unknown as Window & {stockSharedPdf:string}).stockSharedPdf)).toContain(product.name);
  await page.evaluate(()=>{Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>false})});const downloadEvent=page.waitForEvent("download");await page.getByRole("button",{name:"Share report",exact:true}).click();expect((await downloadEvent).suggestedFilename()).toBe("stock-summary.pdf");await expect(page.getByRole("status").filter({hasText:"PDF downloaded"})).toBeVisible();
  await page.getByRole("textbox",{name:"Search stock"}).fill("No matching archived item");await expect(page.getByRole("status").filter({hasText:"No stock items match"})).toBeVisible();await page.getByRole("button",{name:"Reset filters"}).click();await expect(page.getByRole("textbox",{name:"Search stock"})).toHaveValue("");
  await db.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:false}}});
  await expect(mobileStockSummary(principal,{branchId})).rejects.toThrow();expect((await page.request.get(href!)).status()).toBe(403);
  await page.goto(`/workspace/account/inventory/stock-summary?branchId=${branchId}`);await expect(page.getByRole("alert").filter({hasText:"Stock Summary is unavailable"})).toBeVisible();await page.getByRole("link",{name:"Return to Account",exact:true}).click();
  await db.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:true},enabledModules:[]}});expect((await mobileStockSummary(principal,{branchId,q:product.name})).filtered.map(row=>row.id)).toEqual([product.id]);expect((await page.request.get(href!)).status()).toBe(200);
 }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules,itemSettings:original.itemSettings??{},displayDecimalPlaces:original.displayDecimalPlaces}})}
});


test("A062 units preserve concurrent rules, paginate native choices and show safe save feedback",async({page})=>{
 test.setTimeout(150000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{itemSettings:{...(original.itemSettings as object??{}),enabled:true,itemUnits:true}}});
  const ids:string[]=Array.from({length:205},()=>randomUUID());await db.accountUnit.createMany({data:ids.map((id,index)=>({id,companyId,name:`A062 Unit ${String(index).padStart(3,"0")}`,symbol:`AU${index}`}))});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
  const principal={...actor,productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const]};
  const nativeUnits=[];for(let offset=0;;offset+=200){const rows=await listMobileAccountMaster(principal,"units",{active:"true",offset});nativeUnits.push(...rows);if(rows.length<200)break;}expect(nativeUnits.map(row=>row.id)).toContain(ids[204]);
  await Promise.all([saveMobileUnitConversion(principal,{baseUnitId:ids[0],secondaryUnitId:ids[1],rate:"12"}),saveMobileUnitConversion(principal,{baseUnitId:ids[2],secondaryUnitId:ids[3],rate:"24"})]);
  const rules=((await db.accountSettings.findUniqueOrThrow({where:{companyId}})).itemSettings as {unitConversions:Array<{baseUnitId:string;rate:string}>}).unitConversions;expect(rules.filter(row=>[ids[0],ids[2]].includes(row.baseUnitId))).toHaveLength(2);
  await signInSettings(page);await page.goto("/workspace/account/inventory/units");await expect(page.getByRole("navigation",{name:"Items sections"})).toContainText("ProductsServicesCategoriesUnits");await page.getByRole("textbox",{name:"Search Unit"}).fill("A062 Unit 204");await expect(page.locator(".unit-list").getByText("A062 UNIT 204",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Add Unit",exact:false}).click();const editor=page.getByRole("dialog",{name:"Add Unit",exact:true});await expect(editor.getByRole("textbox",{name:"Full Unit Name"})).toBeFocused();expect((await new AxeBuilder({page}).include(".items-manager-page").analyze()).violations).toEqual([]);await page.keyboard.press("Escape");await expect(editor).not.toBeVisible();await page.getByRole("button",{name:"Add Unit",exact:false}).click();await editor.getByRole("textbox",{name:"Full Unit Name"}).fill("A062 Unit 000");await editor.getByRole("textbox",{name:"Short Name"}).fill("NEW-A062");await editor.getByRole("button",{name:"Save",exact:true}).click();await expect(editor.getByRole("alert")).toContainText("already exists");await expect(editor.getByRole("textbox",{name:"Short Name"})).toHaveValue("NEW-A062");
  await editor.getByRole("textbox",{name:"Full Unit Name"}).fill("A062 Created Unit");await editor.getByRole("button",{name:"Save",exact:true}).click();await expect(editor).not.toBeVisible();expect(await db.accountUnit.count({where:{companyId,name:"A062 Created Unit",symbol:"NEW-A062"}})).toBe(1);
  await page.getByRole("button",{name:"Set Conversion",exact:true}).click();const conversion=page.getByRole("dialog",{name:"Set Conversion",exact:true});await conversion.getByLabel("Base unit",{exact:true}).selectOption(ids[0]);await conversion.getByLabel("Secondary unit",{exact:true}).selectOption(ids[204]);await conversion.getByLabel("Conversion Rate",{exact:true}).fill("1.25");await conversion.getByRole("button",{name:"Save",exact:true}).click();await expect(conversion).not.toBeVisible();expect(((await db.accountSettings.findUniqueOrThrow({where:{companyId}})).itemSettings as {unitConversions:Array<{secondaryUnitId:string;rate:string}>}).unitConversions.find(row=>row.secondaryUnitId===ids[204])?.rate).toBe("1.25");
  await db.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:true,itemUnits:false}}});await expect(listMobileAccountMaster(principal,"units",{})).rejects.toThrow();await expect(saveMobileUnitConversion(principal,{baseUnitId:ids[0],secondaryUnitId:ids[1],rate:"2"})).rejects.toThrow();await page.reload();await expect(page.getByRole("alert").filter({hasText:"Units are unavailable"})).toBeVisible();
 }finally{await db.accountSettings.update({where:{companyId},data:{itemSettings:original.itemSettings??{}}})}
});
