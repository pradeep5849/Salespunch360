import {currentPartyBalanceForActor} from "../src/lib/account/party-balance";
import {reportCalendarDate,reportPeriodBounds} from "../src/lib/account/reports/dates";
import {formatMoney,resolveDisplayPreferences} from "../src/lib/account/display-preferences";
import {createExpenseForActor} from "../src/lib/account/expenses";
import {extractPdfText} from "../tests/helpers/pdf-text";
import AxeBuilder from "@axe-core/playwright";
import {mobileStockSummary,mobileStockSummaryExport} from "../src/lib/mobile/account-inventory";
import {reversePostedSaleForActor} from "../src/lib/account/sale-amendments";
import {setupOwnerFinancialAccountForActor,postOwnerTransactionForActor} from "../src/lib/account/money";
import {runFinancialReportForActor} from "../src/lib/account/reports/service";
import {reverseJournalForActor,postJournalForActor} from "../src/lib/accounting/service";
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
 if(settingsCookies.length){await page.context().addCookies(settingsCookies);await page.goto("/workspace/account");await expect(page).toHaveURL(/\/workspace\/account/,{timeout:20000});return}
 await page.goto("/sign-in");await page.getByLabel("Email",{exact:true}).fill(email);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign In",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/account/,{timeout:20000});
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
  await db.ownerAssetFundingReturn.deleteMany({where:{companyId}});
  await db.assetOwnerFundingCancellation.deleteMany({where:{companyId}});
  await db.assetFundingConfirmation.deleteMany({where:{companyId}});
  await db.assetOwnerFunding.deleteMany({where:{companyId}});
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
    await tx.projectChangeOrder.deleteMany({where:{companyId}});
    await tx.ownerTransaction.deleteMany({where:{companyId}});
    await tx.moneyTransferImage.deleteMany({where:{companyId}});
    await tx.moneyTransfer.deleteMany({where:{companyId}});
    await tx.loanOperation.deleteMany({where:{companyId}});
    await tx.loanPayment.deleteMany({where:{companyId}});
    await tx.loan.deleteMany({where:{companyId}});
    await tx.partyOpeningBalance.deleteMany({where:{companyId}});
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
  await db.productPrice.deleteMany({where:{companyId}});
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
 const headers={authorization:`Bearer ${token}`};
 const nativeBefore=await page.request.get("/api/v1/mobile/account/settings",{headers});expect(nativeBefore.status()).toBe(200);
 const nativeSettings=(await nativeBefore.json()).settings.transactionDefaults.invoicePrintSettings;
 const nativeOptions={...nativeSettings,regularDefault:true,pageSize:"A5",orientation:"PORTRAIT",theme:"CLASSIC",itemTableColumns:"ITEM,QTY,AMOUNT",minRows:4,amountDecimal:false,termsText:"Native print round trip"};
 try{
  const saved=await page.request.post("/api/v1/mobile/account/settings/invoice-print-settings",{headers,data:nativeOptions});expect(saved.status()).toBe(200);
  const nativeReload=await page.request.get("/api/v1/mobile/account/settings",{headers});expect((await nativeReload.json()).settings.transactionDefaults.invoicePrintSettings).toMatchObject(nativeOptions);
  const nativeOutput=await page.request.get(`/api/v1/mobile/account/print/SALES_INVOICE/${printDocumentId}`,{headers});expect(nativeOutput.status()).toBe(200);
  const nativeDocument=await PDFDocument.load(await nativeOutput.body());expect(Math.round(nativeDocument.getPage(0).getWidth())).toBe(420);expect(Math.round(nativeDocument.getPage(0).getHeight())).toBe(595);
  expect((await extractPdfText(await nativeOutput.body())).text).toContain("Native print round trip");
  await page.reload();await expect(page.locator('select[name="pageSize"]')).toHaveValue("A5");await expect(page.locator('select[name="orientation"]')).toHaveValue("PORTRAIT");
 }finally{const restored=await page.request.post("/api/v1/mobile/account/settings/invoice-print-settings",{headers,data:nativeSettings});expect(restored.status()).toBe(200)}
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
  const pdf=await page.request.get(`/workspace/account/quotations/${quote.id}/pdf`);expect(pdf.status()).toBe(200);const pdfText=(await extractPdfText(await pdf.body())).text;expect(pdfText).toContain("QUOTE-EDITED");expect(pdfText).not.toContain("INTERNAL-DO-NOT-SHARE");
  await transitionQuotationForActor(actor,quote.id,"PENDING_APPROVAL");await transitionQuotationForActor(actor,quote.id,"APPROVED");
  const shared=await createQuotationShareForActor(actor,quote.id);const token=shared;
  const publicQuote=await getPublicQuotation(token);expect(publicQuote.customFields).toEqual([{label:"Quotation site reference",value:"QUOTE-EDITED"}]);expect(JSON.stringify(publicQuote)).not.toContain("INTERNAL-DO-NOT-SHARE");
  await page.goto(`/workspace/account/quotations/${quote.id}/revisions/new`);await expect(page.getByLabel("Issue date",{exact:true})).toHaveValue("2026-10-11");await expect(page.getByLabel("Valid until",{exact:true})).toHaveValue("2026-11-11");
  await expect(page.getByRole("combobox",{name:"Document type",exact:true})).toBeDisabled();await expect(page.getByRole("combobox",{name:/^Branch/})).toBeDisabled();await expect(page.getByRole("combobox",{name:/^Customer/})).toBeDisabled();
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
    await createChangeOrderForActor(actor,{projectId:project.id,title:"Formatted additional work",valueDelta:"12.34",estimatedCostDelta:"5.67"});
    await signInSettings(page);
    await page.goto(`/workspace/account/projects/${project.id}/costing`);
    for (const title of ["Contract and revenue","Costs and materials","Payments and outstanding","Profit"])
      await expect(page.getByRole("heading",{name:title,exact:true})).toBeVisible();
    await expect(page.getByText("Final Profit",{exact:true})).toHaveCount(0);
    await expect(page.getByRole("region",{name:"Contract and revenue",exact:true})).toContainText("$123.450");
    await expect(page.getByRole("region",{name:"Profit",exact:true})).toContainText("0.00%");
    await expect(page.getByText("DRAFT · Value $12.340 · Cost $5.670",{exact:true})).toBeVisible();
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
  await expect(summary.locator("article").filter({hasText:"Total Project Value"})).toContainText(new Intl.NumberFormat("en-IN",{style:"currency",currency:"USD",minimumFractionDigits:3,maximumFractionDigits:3}).format(before.metrics.totalProjectValue.add("600").toNumber()));
  await expect(summary.locator("article").filter({hasText:"Active Projects"})).toContainText(String(before.metrics.activeProjects+1));
  await expect(summary.locator("article").filter({hasText:"Projects Closed"})).toContainText(String(before.metrics.projectsClosed+1));
  await expect(page.locator(`a[href="/workspace/account/projects/${closed.id}"]`)).toContainText("Closed");
  await page.locator(`a[href="/workspace/account/projects/${active.id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${active.id}$`),{timeout:20000});
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
  await db.ownerFinancialAccount.update({where:{id:owner.id},data:{name:"José Café"}});
  const ledger=await db.ledgerAccount.create({data:{companyId,code:`A084-${randomUUID().slice(0,8)}`,name:"Withdrawal test cash",accountClass:"ASSET",normalBalance:"DEBIT"}});
  const money=await db.moneyAccount.create({data:{companyId,branchId,name:"Withdrawal test cash",type:"CASH",ledgerAccountId:ledger.id}});
  await postOwnerTransactionForActor(actor,{ownerFinancialAccountId:owner.id,moneyAccountId:money.id,branchId,type:"INVESTMENT",amount:"200",transactionDate:"2026-10-10",reference:"Investment excluded",idempotencyKey:randomUUID()});
  const withdrawal=await postOwnerTransactionForActor(actor,{ownerFinancialAccountId:owner.id,moneyAccountId:money.id,branchId,type:"PROFIT_DISTRIBUTION",amount:"50",transactionDate:"2026-10-11",reference:"Owner withdrawal",idempotencyKey:randomUUID()});
  await reverseJournalForActor(actor,{journalEntryId:withdrawal.journalEntryId,entryDate:"2026-10-12",reason:"Withdrawal reversed for audit"});
  const before=await runFinancialReportForActor(actor,"profit-withdrawal",{from:"2026-10-01",to:"2026-10-11",scope:"all",branchId:"",projectId:"",customerId:"",vendorId:"",productId:"",ledgerId:""});
  expect(before.rows).toHaveLength(1);expect(before.totals?.[3]).toBe("50");expect(before.rows[0][4]).toBe("PROFIT_DISTRIBUTION");
  const after=await runFinancialReportForActor(actor,"profit-withdrawal",{from:"2026-10-01",to:"2026-10-12"});
  expect(after.rows).toHaveLength(2);expect(after.totals?.[3]).toBe("0");
  await signInSettings(page);await page.goto("/workspace/account/reports/profit-withdrawal?scope=all&from=2026-10-01&to=2026-10-11&page=3&q=navigation-only");
  await expect(page.getByRole("heading",{name:"Profit Withdrawal Report",exact:true})).toBeVisible();
  await expect(page.locator(".employees-content")).toContainText("withdrawals are not business expenses");
  const exportHref=await page.getByRole("link",{name:"CSV",exact:true}).getAttribute("href");
  expect(exportHref).not.toContain("page=");expect(exportHref).not.toContain("navigation-only");expect(exportHref).toContain("scope=all");
  expect((await page.request.get(exportHref!)).status()).toBe(200);
  await page.getByRole("button",{name:"Run report",exact:true}).click();
  await expect(page).toHaveURL(/scope=all/);
  await expect(page.locator(".employees-content")).not.toContainText("Invalid UUID");
  await expect(page.locator("table")).toContainText("Owner withdrawal");
  const csv=await page.request.get("/api/account/reports/profit-withdrawal/csv?scope=all&from=2026-10-01&to=2026-10-11");
  expect(csv.status()).toBe(200);const content=await csv.text();expect(content).toContain("Net withdrawals");expect(content).toContain("Scope:");expect(content).not.toContain("Investment excluded");
  const xlsx=await page.request.get("/api/account/reports/profit-withdrawal/xlsx?scope=all&from=2026-10-01&to=2026-10-11");
  expect(xlsx.status()).toBe(200);const book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await xlsx.body()).buffer);
  const values=JSON.stringify(book.worksheets[0].getSheetValues());expect(values).toContain("Net withdrawals");expect(values).toContain("Scope:");expect(values).toContain("Owner withdrawal");expect(values).not.toContain("Investment excluded");
  const pdf=await page.request.get("/api/account/reports/profit-withdrawal/pdf?scope=all&from=2026-10-01&to=2026-10-11");
  expect(pdf.status()).toBe(200);const pdfBytes=await pdf.body();expect((await PDFDocument.load(pdfBytes)).getPageCount()).toBeGreaterThan(0);
  const pdfText=(await extractPdfText(pdfBytes)).text;expect(pdfText).toContain("José Café");expect(pdfText).toContain("Net withdrawals");expect(pdfText).toContain("Scope:");expect(pdfText).not.toContain("Investment excluded");
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
  const draft=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",branchId,partyId:customer.id,issueDate:"2026-10-10",dueDate:"2026-10-20",billingName:"Original billing site",customerPoNumber:"PO-17",customerPoDate:"2026-10-09",transactionTime:"10:15",ewayBillNumber:"123456789012",taxMode:"INCLUSIVE",stateOfSupplyCode:"29",freightAmount:"5",otherChargesAmount:"7",roundOffAmount:"0.25",notes:"Original saved terms",paymentTerms:"Net 10 days",lines:[{lineType:"SERVICE",sourceId:service.id,quantity:"1",rate:"120",taxRate:"18",cessRate:"2",unitName:"Saved unit",unitSymbol:"Su",description:"Original item description",specification:"Saved specification"}]});
  await postCommercialDocumentForActor(actor,{documentId:draft.id});
  await signInSettings(page);await page.goto(`/workspace/account/sales/${draft.id}/edit`);
  await expect(page.getByRole("heading",{name:"Sale",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Delete",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Save & New",exact:true})).toHaveCount(0);
  await expect(page.locator("main").last()).toContainText(draft.documentNumber);await expect(page.getByPlaceholder("Search customer name or phone")).toHaveValue(customer.name);await expect(page.getByPlaceholder("Billing Name(Optional)")).toHaveValue("Original billing site");await expect(page.getByLabel("Customer PO Number",{exact:true})).toHaveValue("PO-17");await expect(page.getByLabel("Transaction Time",{exact:true})).toHaveValue("10:15");
  await expect(page.locator("main").last()).toContainText("132.25");await expect(page.getByLabel("State of Supply",{exact:true})).toHaveValue("29");
  await page.getByText("Terms & Conditions",{exact:true}).click();await expect(page.getByLabel("Terms & Conditions",{exact:true})).toHaveValue("Original saved terms");await page.getByLabel("Terms & Conditions",{exact:true}).fill("Updated saved terms");const terms=page.getByLabel("Terms & Conditions",{exact:true});await terms.focus();await terms.scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));const termsBox=await terms.boundingBox(),footerBox=await page.locator("footer").last().boundingBox();expect(termsBox).not.toBeNull();expect(footerBox).not.toBeNull();expect(termsBox!.y+termsBox!.height).toBeLessThanOrEqual(footerBox!.y-8);await expect(terms).toBeFocused();
  await page.getByRole("button",{name:`Edit item ${service.name}`,exact:true}).click();await expect(page.getByLabel("Rate (Price/Unit)",{exact:true})).toHaveValue("120");await page.getByLabel("Quantity",{exact:true}).fill("2");await page.locator("section").filter({has:page.getByRole("heading",{name:"Add Items to Sale",exact:true})}).getByRole("button",{name:"Save",exact:true}).click();await page.getByRole("button",{name:"Save",exact:true}).click();
  await expect(page).toHaveURL(/\/workspace\/account\/sales\/[a-f0-9-]+$/,{timeout:20000});let replacementId=page.url().split("/").at(-1)!;expect(replacementId).not.toBe(draft.id);
  const replacement=await db.commercialDocument.findUniqueOrThrow({where:{id:replacementId},include:{lines:true}});expect(replacement.grandTotal.toString()).toBe("252.25");expect(replacement.notes).toBe("Updated saved terms");expect(replacement.billingName).toBe("Original billing site");expect(replacement.customerPoNumber).toBe("PO-17");expect(replacement.freightAmount.toString()).toBe("5");expect(replacement.otherChargesAmount.toString()).toBe("7");expect(replacement.roundOffAmount.toString()).toBe("0.25");expect(replacement.dueDate?.toISOString().slice(0,10)).toBe("2026-10-20");expect(replacement.lines[0]).toMatchObject({unitName:"Saved unit",unitSymbol:"Su",specification:"Saved specification",description:"Original item description"});expect(replacement.lines[0].cessRate.toString()).toBe("2");
  expect((await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,draft.id))).outstanding.toString()).toBe("0");
  const principal={...actor,productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const]};
  const retained=await mobileReplaceSale(principal,replacementId,{idempotencyKey:randomUUID(),branchId,partyId:customer.id,issueDate:"2026-10-10",lines:[{originalLineId:replacement.lines[0].id,lineType:"SERVICE",sourceId:service.id,quantity:"2",rate:"120",taxRate:"18",cessRate:"2"}]});replacementId=retained.id;
  const retainedRow=await db.commercialDocument.findUniqueOrThrow({where:{id:replacementId}});expect(retainedRow).toMatchObject({billingName:"Original billing site",customerPoNumber:"PO-17",transactionTime:"10:15",ewayBillNumber:"123456789012",notes:"Updated saved terms",paymentTerms:"Net 10 days"});expect(retainedRow.dueDate?.toISOString().slice(0,10)).toBe("2026-10-20");expect(retainedRow.grandTotal.toString()).toBe("252.25");const retainedLine=await db.commercialDocumentLine.findFirstOrThrow({where:{documentId:replacementId}});expect(retainedLine).toMatchObject({unitName:"Saved unit",unitSymbol:"Su",specification:"Saved specification",description:"Original item description"});
  await page.goto(`/workspace/account/transactions/${replacementId}`);await expect(page).toHaveURL(new RegExp(`/workspace/account/sales/${replacementId}$`));const retainedDetail=page.locator("main").last();for(const label of ["Due date","Payment terms","Purchase order number","E-way bill number","Transaction time"])await expect(retainedDetail.getByText(label,{exact:true})).toBeVisible();for(const value of ["Net 10 days","PO-17","123456789012","10:15","Saved specification","Original item description"])await expect(retainedDetail.getByText(value,{exact:true})).toBeVisible();
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
  await signInSettings(page);await page.goto(`/workspace/account/transactions/${cancelled.id}`);await expect(page).toHaveURL(new RegExp(`/workspace/account/sales/${cancelled.id}$`));const detail=page.locator("main").last();
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
  const pdfHref=await page.getByRole("link",{name:"Download stock summary PDF"}).getAttribute("href");const pdf=await page.request.get(pdfHref!);expect(pdf.status()).toBe(200);expect((await extractPdfText(await pdf.body())).text).toContain("Branch:");
  expect((await page.request.get("/api/account/inventory/stock-summary/xlsx?asOf=2026-02-30")).status()).toBe(400);
  expect((await page.request.get(`/api/account/inventory/stock-summary/xlsx?branchId=${randomUUID()}`)).status()).toBe(403);
  await page.getByRole("textbox",{name:"Search stock"}).fill(product.name);
  await page.evaluate(()=>{Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>true});Object.defineProperty(navigator,"share",{configurable:true,value:async()=>{throw new DOMException("Cancelled","AbortError")}})});await page.getByRole("button",{name:"Share report",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Sharing cancelled."})).toBeVisible();
  await page.evaluate(()=>{Object.defineProperty(navigator,"share",{configurable:true,value:async(data:ShareData)=>{Object.defineProperty(window,"stockSharedPdf",{configurable:true,value:Array.from(new Uint8Array(await data.files![0].arrayBuffer()))})}})});await page.getByRole("button",{name:"Share report",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Report handed"})).toBeVisible();expect((await extractPdfText(new Uint8Array(await page.evaluate(()=>(window as unknown as Window & {stockSharedPdf:number[]}).stockSharedPdf)))).text).toContain(product.name);
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
  await page.getByRole("button",{name:"Set Conversion",exact:true}).click();const conversion=page.getByRole("dialog",{name:"Set Conversion",exact:true});await conversion.getByLabel("Base unit",{exact:true}).selectOption(ids[0]);await conversion.getByLabel("Secondary unit",{exact:true}).selectOption(ids[204]);await conversion.getByLabel("Conversion Rate",{exact:true}).fill("0.00001");await expect(conversion.getByRole("button",{name:"Save",exact:true})).toBeDisabled();await expect(conversion.getByLabel("Conversion Rate",{exact:true})).toHaveAttribute("aria-invalid","true");await conversion.getByLabel("Conversion Rate",{exact:true}).fill("1.25");let releaseSave:()=>void=()=>{};const heldSave=new Promise<void>(resolve=>{releaseSave=resolve});await page.route("**/workspace/account/inventory/units",async route=>{if(route.request().method()==="POST")await heldSave;await route.continue();});try{await conversion.getByRole("button",{name:"Save",exact:true}).click();await expect(conversion.getByLabel("Base unit",{exact:true})).toBeDisabled();await expect(conversion.getByLabel("Secondary unit",{exact:true})).toBeDisabled();await expect(conversion.getByLabel("Conversion Rate",{exact:true})).toBeDisabled();await expect(conversion.getByRole("button",{name:"Cancel",exact:true})).toBeDisabled();await page.keyboard.press("Escape");await expect(conversion).toBeVisible();}finally{releaseSave();}await expect(conversion).not.toBeVisible();await page.unroute("**/workspace/account/inventory/units");expect(((await db.accountSettings.findUniqueOrThrow({where:{companyId}})).itemSettings as {unitConversions:Array<{secondaryUnitId:string;rate:string}>}).unitConversions.find(row=>row.secondaryUnitId===ids[204])?.rate).toBe("1.25");
  await db.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:true,itemUnits:false}}});await expect(listMobileAccountMaster(principal,"units",{})).rejects.toThrow();await expect(saveMobileUnitConversion(principal,{baseUnitId:ids[0],secondaryUnitId:ids[1],rate:"2"})).rejects.toThrow();await page.reload();await expect(page.getByRole("alert").filter({hasText:"Units are unavailable"})).toBeVisible();
 }finally{await db.accountSettings.update({where:{companyId},data:{itemSettings:original.itemSettings??{}}})}
});

test("A064 money account form labels and company-wide creation provide feedback",async({page})=>{
 test.setTimeout(120000);
 if(!await db.financialYear.findFirst({where:{companyId,isActive:true,startDate:{lte:new Date("2026-10-13")},endDate:{gte:new Date("2026-10-13")}}}))await db.financialYear.create({data:{companyId,name:"Opening balance browser year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
 const adjustmentLedger=await db.ledgerAccount.create({data:{companyId,code:"A064-BROWSER-OFFSET",name:"Browser shortage expense",accountClass:"EXPENSE",normalBalance:"DEBIT"}});
 await signInSettings(page);await page.goto("/workspace/account/money/accounts");
 const form=page.locator("form").filter({has:page.getByRole("button",{name:"Create account and asset ledger",exact:true})});
 const initialKey=await form.locator("input[name=creationRequestKey]").inputValue();
 await form.getByLabel("Account display name",{exact:true}).fill(" ");await form.getByRole("button",{name:"Create account and asset ledger",exact:true}).click();await expect(form.locator("#name-error")).toBeVisible();await expect(form.getByLabel("Account display name",{exact:true})).toBeFocused();await expect(form.locator("input[name=creationRequestKey]")).toHaveValue(initialKey);
 await form.getByLabel("Account display name",{exact:true}).fill("A064 Accessible Bank");await form.getByLabel("Account type",{exact:true}).selectOption("BANK");await form.getByLabel("Branch",{exact:true}).selectOption("");await form.getByLabel("Bank name",{exact:true}).fill("A064 Test Bank");await form.getByLabel("Masked account number",{exact:true}).fill("****6543");await form.getByLabel("IFSC",{exact:true}).fill("TEST0001234");
 await form.getByLabel("Starting balance (optional)",{exact:true}).fill("1000.00");await form.getByLabel("As on date",{exact:true}).fill("2026-10-13");await form.getByLabel("Opening journal branch (for company-wide accounts)",{exact:true}).selectOption(branchId);
 expect((await new AxeBuilder({page}).include("form").analyze()).violations).toEqual([]);
 await form.getByRole("button",{name:"Create account and asset ledger",exact:true}).click();await expect(form.getByRole("status")).toContainText("Money account created",{timeout:20000});
 const account=await db.moneyAccount.findFirstOrThrow({where:{companyId,name:"A064 Accessible Bank"}});expect(account.branchId).toBeNull();expect(account.creationRequestKey).toBe(initialKey);await expect(form.locator("input[name=creationRequestKey]")).not.toHaveValue(initialKey);expect(await db.ledgerAccount.findUniqueOrThrow({where:{id:account.ledgerAccountId}})).toMatchObject({name:account.name,companyId});
 const opening=await db.journalEntry.findFirstOrThrow({where:{companyId,sourceId:account.id,postingPurpose:"MONEY_ACCOUNT_OPENING"},include:{lines:true}});expect(opening.lines.find(line=>line.ledgerAccountId===account.ledgerAccountId)?.debit.toFixed(2)).toBe("1000.00");const obe=await db.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"OPENING_BALANCE_EQUITY"}});expect(obe.accountClass).toBe("EQUITY");expect(opening.lines.find(line=>line.ledgerAccountId===obe.id)?.credit.toFixed(2)).toBe("1000.00");

 await page.goto(`/workspace/account/money/accounts/${account.id}?branchId=${branchId}`);await expect(page.getByRole("table",{name:"Account ledger history"})).toContainText("Opening balance");await expect(page.getByRole("table").getByRole("row").last()).toContainText("₹1,000.00");expect((await new AxeBuilder({page}).include(".employees-content").analyze()).violations).toEqual([]);await page.getByLabel("From",{exact:true}).fill("2026-10-14");await page.getByRole("button",{name:"Apply dates"}).click();await expect(page.getByText("No posted entries match these dates.")).toBeVisible();await expect(page.locator("dl")).toContainText("₹1,000.00");

 const adjustment=page.locator("form").filter({has:page.getByRole("button",{name:"Post adjustment",exact:true})});await adjustment.getByLabel("Adjustment",{exact:true}).selectOption("REDUCE");await adjustment.getByLabel("Offset ledger",{exact:true}).selectOption(adjustmentLedger.id);await adjustment.getByLabel("Amount",{exact:true}).fill("50.00");await adjustment.getByLabel("Date",{exact:true}).fill("2026-10-14");await adjustment.getByLabel("Reason",{exact:true}).fill("Confirmed cash count correction");const adjustmentKey=await adjustment.locator("input[name=idempotencyKey]").inputValue();await adjustment.getByLabel("Reason",{exact:true}).fill("   ");await adjustment.getByRole("button",{name:"Post adjustment"}).click();await expect(adjustment.getByLabel("Reason",{exact:true})).toHaveAttribute("aria-invalid","true");await expect(adjustment.getByLabel("Reason",{exact:true})).toBeFocused();const reasonError=await adjustment.getByLabel("Reason",{exact:true}).getAttribute("aria-describedby");expect(reasonError).toBeTruthy();await expect(page.locator(`[id="${reasonError}"]`)).toBeVisible();await expect(adjustment.locator("input[name=idempotencyKey]")).toHaveValue(adjustmentKey);await expect(adjustment.getByLabel("Amount",{exact:true})).toHaveValue("50.00");expect(await db.journalEntry.count({where:{companyId,sourceType:"MONEY_ADJUSTMENT",sourceId:adjustmentKey}})).toBe(0);await adjustment.getByLabel("Reason",{exact:true}).fill("Confirmed cash count correction");await adjustment.getByRole("button",{name:"Post adjustment"}).click();await expect(adjustment.getByRole("status")).toContainText("Account adjustment posted",{timeout:20000});expect(await db.journalEntry.count({where:{companyId,sourceType:"MONEY_ADJUSTMENT",sourceId:adjustmentKey}})).toBe(1);await expect(adjustment.locator("input[name=idempotencyKey]")).not.toHaveValue(adjustmentKey);await expect(page.locator("dl")).toContainText("₹950.00");

});


test("A064 transfer form uses compatible active accounts and posts one balanced transfer",async({page})=>{
 test.setTimeout(120000);
 const {createMoneyAccountForActor}=await import("@/lib/account/money");
 const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
 if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Transfer form year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
 const from=await createMoneyAccountForActor(actor,{name:"A064 Source Bank",type:"BANK",branchId,creationRequestKey:randomUUID()});
 const to=await createMoneyAccountForActor(actor,{name:"A064 Destination Cash",type:"CASH",branchId,creationRequestKey:randomUUID()});
 const inactive=await createMoneyAccountForActor(actor,{name:"A064 Inactive Account",type:"BANK",branchId,creationRequestKey:randomUUID()});await db.moneyAccount.update({where:{id:inactive.id},data:{isActive:false}});
 await signInSettings(page);await page.goto("/workspace/account/money/transfers");const form=page.locator("form").filter({has:page.getByRole("button",{name:"Post transfer / deposit",exact:true})});
 await form.getByLabel("Branch",{exact:true}).selectOption(branchId);expect(await form.getByLabel("From account",{exact:true}).locator("option").allTextContents()).not.toContain(inactive.name);
 await expect(form.getByRole("button",{name:"Post transfer / deposit",exact:true})).toBeDisabled();await form.getByLabel("From account",{exact:true}).selectOption(from.id);expect(await form.getByLabel("To account",{exact:true}).evaluate((node,id)=>Array.from((node as HTMLSelectElement).options).every(option=>option.value!==id||option.disabled),from.id)).toBe(true);await form.getByLabel("To account",{exact:true}).selectOption(to.id);
 await form.getByLabel("Amount",{exact:true}).fill("0");await expect(form.getByRole("button",{name:"Post transfer / deposit",exact:true})).toBeDisabled();
 await form.getByLabel("Amount",{exact:true}).fill("12.50");await form.getByLabel("Transfer date",{exact:true}).fill("2026-10-13");await form.getByLabel("Reference",{exact:true}).fill("A064 browser transfer");const key=await form.locator("input[name=idempotencyKey]").inputValue();expect((await new AxeBuilder({page}).include("form").analyze()).violations).toEqual([]);
 await form.getByRole("button",{name:"Post transfer / deposit",exact:true}).click();await expect(form.getByRole("status").filter({hasText:"Transfer posted"})).toBeVisible({timeout:20000});
 const saved=await db.moneyTransfer.findMany({where:{companyId,idempotencyKey:key}});expect(saved).toHaveLength(1);expect(saved[0].amount.toFixed(2)).toBe("12.50");const lines=await db.journalLine.findMany({where:{journalEntryId:saved[0].journalEntryId}});expect(lines).toHaveLength(2);expect(lines.find(row=>row.ledgerAccountId===from.ledgerAccountId)?.credit.toFixed(2)).toBe("12.50");expect(lines.find(row=>row.ledgerAccountId===to.ledgerAccountId)?.debit.toFixed(2)).toBe("12.50");await expect(form.getByLabel("Amount",{exact:true})).toHaveValue("");await expect(form.locator("input[name=idempotencyKey]")).not.toHaveValue(key);
});

test("A064 bank and cash destinations separate account types and retain company isolation",async({page})=>{
 test.setTimeout(120000);
 const {createMoneyAccountForActor}=await import("@/lib/account/money");const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
 const bank=await createMoneyAccountForActor(actor,{name:"A064 Directory Bank",type:"BANK",branchId,creationRequestKey:randomUUID()});const cash=await createMoneyAccountForActor(actor,{name:"A064 Directory Cash",type:"CASH",branchId,creationRequestKey:randomUUID()});await db.moneyAccount.update({where:{id:bank.id},data:{isActive:false}});
 const foreignLedger=await db.ledgerAccount.create({data:{companyId:otherCompanyId,code:"A064-FOREIGN",name:"Foreign bank",accountClass:"ASSET",normalBalance:"DEBIT"}});const foreign=await db.moneyAccount.create({data:{companyId:otherCompanyId,type:"BANK",name:"A064 Foreign Bank",ledgerAccountId:foreignLedger.id}});
 try{
 await signInSettings(page);await page.goto("/workspace/account/money/bank-accounts");await expect(page.getByRole("heading",{name:"Bank Accounts",exact:true})).toBeVisible();const banks=page.getByRole("list",{name:"Bank Accounts list"});await expect(banks).toContainText(bank.name);await expect(banks).toContainText("Inactive");await expect(banks).not.toContainText(cash.name);await expect(banks).not.toContainText(foreign.name);expect((await new AxeBuilder({page}).include(".employees-content").analyze()).violations).toEqual([]);
 await page.getByRole("navigation",{name:"Cash and bank sections"}).getByRole("link",{name:"Cash In-Hand",exact:true}).click();await expect(page.getByRole("heading",{name:"Cash In-Hand",exact:true})).toBeVisible();const cashList=page.getByRole("list",{name:"Cash In-Hand list"});await expect(cashList).toContainText(cash.name);await expect(cashList).not.toContainText(bank.name);await page.getByRole("link",{name:"Add cash account",exact:true}).click();await expect(page.getByLabel("Account type",{exact:true})).toHaveValue("CASH");
 await page.goto("/workspace/account/money/bank-accounts");await page.getByRole("link",{name:"Add bank account",exact:true}).click();await expect(page.getByLabel("Account type",{exact:true})).toHaveValue("BANK");
 }finally{await db.moneyAccount.delete({where:{id:foreign.id}});await db.ledgerAccount.delete({where:{id:foreignLedger.id}})}
});

test("A064 shared account balances follow validated branch context on web and native API",async({page})=>{
 test.setTimeout(180000);
 const {createMoneyAccountForActor,createMoneyTransferForActor}=await import("@/lib/account/money");const second=randomUUID(),foreign=randomUUID();await db.branch.create({data:{id:second,companyId,name:"A064 Context Second Branch",code:"CTX2"}});await db.branch.create({data:{id:foreign,companyId:otherCompanyId,name:"Foreign context branch",code:"CTXF"}});
 const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
 if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Money scope year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
 const shared=await createMoneyAccountForActor(actor,{name:"A064 Scoped Shared Bank",type:"BANK",creationRequestKey:randomUUID()}),cash1=await createMoneyAccountForActor(actor,{name:"A064 Scoped First Cash",type:"CASH",branchId,creationRequestKey:randomUUID()}),cash2=await createMoneyAccountForActor(actor,{name:"A064 Scoped Second Cash",type:"CASH",branchId:second,creationRequestKey:randomUUID()});
 await createMoneyTransferForActor(actor,{branchId,sourceAccountId:shared.id,destinationAccountId:cash1.id,amount:"10",transferDate:"2026-10-13",idempotencyKey:randomUUID()});await createMoneyTransferForActor(actor,{branchId:second,sourceAccountId:shared.id,destinationAccountId:cash2.id,amount:"20",transferDate:"2026-10-13",idempotencyKey:randomUUID()});
 try{
 await signInSettings(page);await page.goto(`/workspace/account/money/bank-accounts?branchId=${branchId}`);let row=page.getByRole("list",{name:"Bank Accounts list"}).getByRole("listitem").filter({hasText:shared.name});await expect(row.locator(".account-money")).toHaveText("-₹10.00");
 await page.goto(`/workspace/account/money/bank-accounts?branchId=${second}`);row=page.getByRole("list",{name:"Bank Accounts list"}).getByRole("listitem").filter({hasText:shared.name});await expect(row.locator(".account-money")).toHaveText("-₹20.00");await expect(page.getByText("Scope: A064 Context Second Branch",{exact:true})).toBeVisible();await page.getByRole("navigation",{name:"Cash and bank sections"}).getByRole("link",{name:"Cash In-Hand",exact:true}).click();await expect(page).toHaveURL(new RegExp(`branchId=${second}`));await expect(page.getByRole("list",{name:"Cash In-Hand list"})).toContainText(cash2.name);await expect(page.getByRole("list",{name:"Cash In-Hand list"})).not.toContainText(cash1.name);
 await page.goto("/workspace/account/money/bank-accounts?scope=all");row=page.getByRole("list",{name:"Bank Accounts list"}).getByRole("listitem").filter({hasText:shared.name});await expect(row.locator(".account-money")).toHaveText("-₹30.00");await page.goto(`/workspace/account/money/bank-accounts?branchId=${foreign}`);await expect(page.getByRole("alert").filter({hasText:"unavailable for the requested branch"})).toBeVisible();
 const token=createSessionToken(),sessionUser=await db.user.findUniqueOrThrow({where:{id:userId}});await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:sessionUser.sessionVersion}});const headers={authorization:`Bearer ${token}`};const native=await page.request.get(`/api/v1/mobile/account/money?branchId=${second}`,{headers});expect(native.status()).toBe(200);const nativeData=await native.json();expect(nativeData.branchContext).toMatchObject({mode:"BRANCH",branchId:second});expect(nativeData.dashboard.accounts.find((account:{id:string})=>account.id===shared.id).balance).toBe("-20");expect(native.headers()["cache-control"]).toBe("no-store");expect((await page.request.get(`/api/v1/mobile/account/money?branchId=${foreign}`,{headers})).status()).toBe(403);expect((await page.request.get(`/api/v1/mobile/account/money?branchId=${second}&scope=all`,{headers})).status()).toBe(400);
 await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNTANT"}});expect((await page.request.get("/api/v1/mobile/account/money?scope=all",{headers})).status()).toBe(403);await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN",branchAccessScope:"SELECTED_BRANCHES"}});await db.userBranchAccess.create({data:{userId,branchId}});expect((await page.request.get(`/api/v1/mobile/account/money?branchId=${second}`,{headers})).status()).toBe(403);expect((await page.request.get(`/api/v1/mobile/account/money?branchId=${branchId}`,{headers})).status()).toBe(200);
 }finally{await db.userBranchAccess.deleteMany({where:{userId,branchId}});await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN",branchAccessScope:"ALL_BRANCHES"}});await db.branch.delete({where:{id:foreign}})}
});

test("A063 menu and native bootstrap honor Items OFF and authorized branch choices",async({page})=>{
 test.setTimeout(120000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 const second=randomUUID(),inactive=randomUUID();
 await db.branch.createMany({data:[{id:second,companyId,name:"A063 Second Branch",code:"A063-SECOND"},{id:inactive,companyId,name:"A063 Inactive Branch",code:"A063-INACTIVE",isActive:false}]});
 try{
  const {mobileAccountBootstrap}=await import("@/lib/mobile/account");
  const user=await db.user.findUniqueOrThrow({where:{id:userId}});
  const principal={...user,companyId,branchIds:[],productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const]};
  await db.accountSettings.update({where:{companyId},data:{itemSettings:{...(original.itemSettings as object??{}),enabled:false}}});
  await signInSettings(page);await page.goto("/workspace/account/menu");await expect(page.getByRole("heading",{name:"Inventory",exact:true})).toHaveCount(0);await expect(page.getByRole("heading",{name:"Cash & Bank",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"A063 Second Branch",exact:false})).toBeVisible();await expect(page.getByRole("button",{name:"A063 Inactive Branch",exact:false})).toHaveCount(0);
  const native=await mobileAccountBootstrap(principal,{branchId});expect(native.navigation.some(g=>g.label==="Inventory")).toBe(false);expect(native.availableBranches.map(b=>b.id)).toContain(second);expect(native.availableBranches.map(b=>b.id)).not.toContain(inactive);expect(native.canConsolidate).toBe(true);
  expect((await mobileAccountBootstrap(principal,{scope:"all"})).branch.mode).toBe("COMPANY");
  await expect(mobileAccountBootstrap({...principal,branchAccessScope:"SELECTED_BRANCHES",branchIds:[branchId]},{branchId:second})).rejects.toThrow();await expect(mobileAccountBootstrap({...principal,accountRole:"ACCOUNTANT"},{scope:"all"})).rejects.toThrow();await expect(mobileAccountBootstrap(principal,{branchId:inactive})).rejects.toThrow();
  await db.accountSettings.update({where:{companyId},data:{itemSettings:{...(original.itemSettings as object??{}),enabled:true}}});await page.reload();await expect(page.getByRole("heading",{name:"Inventory",exact:true})).toBeVisible();expect((await mobileAccountBootstrap(principal,{branchId})).navigation.some(g=>g.label==="Inventory")).toBe(true);
 }finally{await db.accountSettings.update({where:{companyId},data:{itemSettings:original.itemSettings??{}}});await db.branch.deleteMany({where:{id:{in:[second,inactive]},companyId}})}
});

test("A070 expense alerts reconcile badge and paginated web/native branch scope without dashboard-only disclosure",async({page})=>{
 test.setTimeout(120000);
 const second=randomUUID(),categoryId=randomUUID();
 const ledger=await db.ledgerAccount.create({data:{companyId,code:"A070-ALERT-OFFSET",name:"Alert fixture expense",accountClass:"EXPENSE",normalBalance:"DEBIT"}});
 await db.expenseCategory.create({data:{id:categoryId,companyId,name:"A070 Alert category",scope:"EXPENSE",defaultLedgerAccountId:ledger.id}});
 await db.branch.create({data:{id:second,companyId,name:"A070 Other Branch",code:"A070-OTHER"}});
 const ids=Array.from({length:102},()=>randomUUID());
 await db.expenseTransaction.createMany({data:ids.map((id,i)=>({id,companyId,branchId:i===101?second:branchId,categoryId,type:"OFFICE_EXPENSE" as const,status:"PENDING_APPROVAL" as const,transactionNumber:`A070-${String(i).padStart(3,"0")}`,transactionDate:new Date("2026-10-13"),taxableAmount:"10",totalAmount:"10",createdById:userId,createdAt:new Date("2026-10-13T12:00:00Z")}))});
 try{
  const {pendingExpenseAlertsForActor}=await import("@/lib/account/expense-alerts");const {mobileNotifications}=await import("@/lib/mobile/account-administration");const {mobileAccountBootstrap}=await import("@/lib/mobile/account");
  const user=await db.user.findUniqueOrThrow({where:{id:userId}}),actor={...user,companyId,branchIds:[]} as ProjectActor;
  const principal={...actor,productEdition:"SALESPUNCH360_ACCOUNT" as const,authorizedWorkspaces:["ACCOUNT" as const]};
  const first=await mobileNotifications(principal,{branchId,limit:50}),middle=await mobileNotifications(principal,{branchId,offset:50,limit:50}),last=await mobileNotifications(principal,{branchId,offset:100,limit:50});expect(first.expenseTotal).toBe(101);expect(first.rows).toHaveLength(50);expect(middle.rows).toHaveLength(50);expect(last.rows).toHaveLength(1);expect(new Set([...first.rows,...middle.rows,...last.rows].map(x=>x.id)).size).toBe(101);expect(last.hasMoreExpenses).toBe(false);expect((await mobileAccountBootstrap(principal,{branchId})).notifications.pendingExpenseApprovals).toBe(first.expenseTotal);
  expect((await pendingExpenseAlertsForActor(actor,{branchId:second})).total).toBe(1);expect((await pendingExpenseAlertsForActor(actor,{scope:"all"})).total).toBe(102);
  await signInSettings(page);await page.goto("/workspace/account");await expect(page.getByRole("link",{name:"101 account notifications",exact:true})).toBeVisible();await page.getByRole("link",{name:"101 account notifications",exact:true}).click();await expect(page.getByRole("heading",{name:"101 expenses await review"})).toBeVisible();await expect(page.locator(".account-card ul > li")).toHaveCount(50);await page.getByRole("navigation",{name:"Expense alert pages"}).getByRole("link",{name:"Next",exact:true}).click();await expect(page.getByRole("navigation",{name:"Expense alert pages"}).getByRole("link",{name:"Next",exact:true})).toHaveAttribute("href",/offset=100/);await expect(page.locator(".account-card ul > li")).toHaveCount(50);await page.getByRole("navigation",{name:"Expense alert pages"}).getByRole("link",{name:"Next",exact:true}).click();await expect(page.locator(".account-card ul > li")).toHaveCount(1);
  await page.goto(`/workspace/account/notifications?branchId=${second}`);await expect(page.getByRole("heading",{name:"1 expenses await review"})).toBeVisible();await expect(page.getByRole("link",{name:"A070-101",exact:true})).toBeVisible();expect((await new AxeBuilder({page}).include(".account-main").analyze()).violations).toEqual([]);
  expect((await mobileNotifications({...principal,accountRole:"DATA_ENTRY"},{branchId})).expenseTotal).toBe(0);await expect(mobileNotifications({...principal,branchAccessScope:"SELECTED_BRANCHES",branchIds:[branchId]},{branchId:second})).rejects.toThrow();
  await db.user.update({where:{id:userId},data:{accountRole:"DATA_ENTRY"}});await signInSettings(page);await page.goto("/workspace/account/notifications");await expect(page.getByRole("link",{name:/A070-/})).toHaveCount(0);await expect(page.getByText("All caught up",{exact:true})).toBeVisible();
 }finally{await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});await db.expenseTransaction.deleteMany({where:{id:{in:ids},companyId}});await db.expenseCategory.delete({where:{id:categoryId}});await db.branch.delete({where:{id:second}});await db.ledgerAccount.delete({where:{id:ledger.id}})}
});

test("A070 Sales notification rows stay compact and preserve long text and read actions",async({page})=>{
 test.setTimeout(120000);
 const company=await db.company.findUniqueOrThrow({where:{id:companyId}}),user=await db.user.findUniqueOrThrow({where:{id:userId}}),otherUser=randomUUID(),otherNotification=randomUUID(),ids=[randomUUID(),randomUUID(),randomUUID()];
 await signInSettings(page);
 try{
 await db.company.update({where:{id:companyId},data:{productEdition:"SALESPUNCH360_PLUS"}});await db.user.update({where:{id:userId},data:{salesAccessActive:true,salesRole:"PRIMARY_ADMIN"}});
 await db.user.create({data:{id:otherUser,companyId,name:"Other Sales recipient",email:`other-sales-${otherUser}@example.test`,passwordHash:"isolated-unused",role:"SALES",salesRole:"SALES",salesAccessActive:true}});
 await db.salesNotification.createMany({data:[{id:ids[0],companyId,recipientUserId:userId,eventType:"LEAD_STAGE_CHANGED",title:"Lead update",body:"Lead assigned. Review the next step.",navigationTarget:"/workspace/account/menu",dedupeKey:ids[0]},{id:ids[1],companyId,recipientUserId:userId,eventType:"FOLLOW_UP_ASSIGNED",title:"Long notification "+"important ".repeat(12),body:"Full details remain readable. "+"long-detail-".repeat(60),dedupeKey:ids[1]},{id:ids[2],companyId,recipientUserId:userId,eventType:"FOLLOW_UP_ASSIGNED",title:"Already read update",body:"This update was read.",readAt:new Date(),dedupeKey:ids[2]},{id:otherNotification,companyId,recipientUserId:otherUser,eventType:"FOLLOW_UP_ASSIGNED",title:"Other recipient private alert",body:"Must not be disclosed.",dedupeKey:otherNotification}]});
  await page.goto("/workspace/notifications");await expect(page.getByRole("heading",{name:"Notifications",exact:true})).toBeVisible();await expect(page.getByText("2 unread",{exact:true})).toBeVisible();await expect(page.getByText("Other recipient private alert")).toHaveCount(0);
  const short=page.locator(".notification-item").filter({hasText:"Lead update"});expect(await short.evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(190);await expect(short.getByRole("link",{name:"Open",exact:true})).toHaveAttribute("href","/workspace/account/menu");for(const button of await short.locator(".button").all()){expect(await button.evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)}
  const long=page.locator(".notification-item").filter({hasText:"Long notification"});await expect(long.locator("p")).toContainText("long-detail-".repeat(60));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);expect((await new AxeBuilder({page}).include(".notification-list").analyze()).violations).toEqual([]);
  await short.getByRole("button",{name:"Mark read",exact:true}).click();await expect(page.getByText("1 unread",{exact:true})).toBeVisible();await expect(short.getByRole("button",{name:"Mark read",exact:true})).toHaveCount(0);await page.getByRole("button",{name:"Mark all as read",exact:true}).click();await expect(page.getByText("0 unread",{exact:true})).toBeVisible();expect((await db.salesNotification.findUniqueOrThrow({where:{id:otherNotification}})).readAt).toBeNull();await short.getByRole("link",{name:"Open",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/account\/menu$/);
 }finally{await db.salesNotification.deleteMany({where:{id:{in:[...ids,otherNotification]}}});await db.user.deleteMany({where:{id:otherUser}});await db.user.update({where:{id:userId},data:{salesAccessActive:user.salesAccessActive,salesRole:user.salesRole}});await db.company.update({where:{id:companyId},data:{productEdition:company.productEdition}})}
});

test("A071 Home search preserves normalized filters and branch context through tabs and history",async({page})=>{
 test.setTimeout(120000);
 const second=randomUUID();await db.branch.create({data:{id:second,companyId,name:"A071 Search Branch",code:"A071-SEARCH"}});
 try{
  await signInSettings(page);await page.goto(`/workspace/account?branchId=${second}&types=SALES_INVOICE,SALES_INVOICE,UNKNOWN`);
  const search=()=>page.getByRole("searchbox",{name:"Search party or document number",exact:true});await search().fill("Acme");await search().press("Enter");await expect(page).toHaveURL(/q=Acme/);let url=new URL(page.url());expect(url.searchParams.get("branchId")).toBe(second);expect(url.searchParams.get("types")).toBe("SALES_INVOICE");expect(url.searchParams.has("scope")).toBe(false);
  await search().fill("");await search().press("Enter");await expect.poll(()=>new URL(page.url()).searchParams.get("q")).toBe("");await expect(search()).toHaveValue("");await page.goBack({waitUntil:"networkidle"});await expect(search()).toHaveValue("Acme");expect(new URL(page.url()).searchParams.get("branchId")).toBe(second);await page.goForward({waitUntil:"networkidle"});await expect(search()).toHaveValue("");
  await page.getByRole("tab",{name:"Party Details",exact:true}).click();const partySearch=page.getByRole("searchbox",{name:"Search parties",exact:true});await partySearch.fill("North");await partySearch.press("Enter");await expect(page).toHaveURL(/q=North/);url=new URL(page.url());expect(url.searchParams.get("tab")).toBe("parties");expect(url.searchParams.get("branchId")).toBe(second);expect(url.searchParams.has("types")).toBe(false);
  await page.getByRole("tab",{name:"Transaction Details",exact:true}).click();await expect(search()).toHaveValue("");expect(new URL(page.url()).searchParams.get("branchId")).toBe(second);
  await page.goto("/workspace/account?scope=all&types=SALES_INVOICE");await search().fill("Any");await search().press("Enter");await expect(page).toHaveURL(/q=Any/);url=new URL(page.url());expect(url.searchParams.get("scope")).toBe("all");expect(url.searchParams.has("branchId")).toBe(false);expect(url.searchParams.get("types")).toBe("SALES_INVOICE");
 }finally{await db.branch.delete({where:{id:second}})}
});

test("A071 New Party creates Account-only customers in the selected branch and enforces fields and permissions",async({page})=>{
 test.setTimeout(120000);
 const branch=randomUUID(),foreign=randomUUID(),fieldId=randomUUID(),name=`A071 New Party ${randomUUID().slice(0,8)}`;
 await db.branch.create({data:{id:branch,companyId,name:"A071 Party Branch",code:"A071-PARTY"}});await db.branch.create({data:{id:foreign,companyId:otherCompanyId,name:"Foreign party branch",code:"A071-FOREIGN"}});
 await db.customFieldDefinition.create({data:{id:fieldId,companyId,entityType:"CUSTOMER",fieldKey:"a071_contact_confirmed",label:"Contact confirmed",dataType:"BOOLEAN",isRequired:true,isActive:true}});
 try{
  await signInSettings(page);await page.goto(`/workspace/account?tab=parties&branchId=${branch}`);const create=page.getByRole("link",{name:"+ Add New Party",exact:true});await expect(create).toHaveAttribute("href",new RegExp(`^/workspace/account/customers/new\\?branchId=${branch}$`));await create.click();await expect(page.getByRole("heading",{name:"New Party",exact:true})).toBeVisible();const form=page.locator("form.account-form");await expect(form.getByLabel("Branch",{exact:true})).toHaveValue(branch);await form.getByLabel("Party name",{exact:true}).fill(name);await form.getByLabel("Phone",{exact:true}).fill("9000000000");await form.getByLabel("Contact confirmed",{exact:true}).evaluate(el=>el.removeAttribute("required"));await form.getByRole("button",{name:"Create party",exact:true}).click();await expect(form.getByRole("alert")).toContainText(/required/i);expect(await db.customer.count({where:{companyId,name}})).toBe(0);await form.getByLabel("Contact confirmed",{exact:true}).selectOption("false");
  expect((await new AxeBuilder({page}).include("form").analyze()).violations).toEqual([]);
  await form.getByLabel("Branch",{exact:true}).evaluate((el,id)=>{const select=el as HTMLSelectElement;const option=document.createElement("option");option.value=id;option.textContent="Forged foreign branch";select.append(option);select.value=id;select.dispatchEvent(new Event("change",{bubbles:true}))},foreign);await form.getByRole("button",{name:"Create party",exact:true}).click();await expect(form.getByRole("alert")).toBeVisible();expect(await db.customer.count({where:{companyId,name}})).toBe(0);await expect(form.getByLabel("Party name",{exact:true})).toHaveValue(name);await form.getByLabel("Branch",{exact:true}).selectOption(branch);await form.getByRole("button",{name:"Create party",exact:true}).click();await expect(page).toHaveURL(new RegExp(`/workspace/account\\?tab=parties&branchId=${branch}$`));await expect(page.locator(".account-home-list")).toContainText(name);
  const customer=await db.customer.findFirstOrThrow({where:{companyId,name}});expect(customer.branchId).toBe(branch);expect(customer.isAccountCustomer).toBe(true);expect((await db.customFieldValue.findFirstOrThrow({where:{companyId,definitionId:fieldId,entityId:customer.id}})).value).toBe(false);await page.locator(".account-party-card").filter({hasText:name}).click();await expect(page.getByRole("heading",{name:"Account Parties",exact:true})).toBeVisible();expect(new URL(page.url()).searchParams.get("branchId")).toBe(branch);await expect(page.getByRole("heading",{name,exact:true})).toBeVisible();
  await db.user.update({where:{id:userId},data:{accountRole:"PROJECT_MANAGER"}});await page.goto(`/workspace/account?tab=parties&branchId=${branch}`);await expect(page.getByRole("link",{name:"+ Add New Party",exact:true})).toHaveCount(0);await page.goto(`/workspace/account/customers/new?branchId=${branch}`);await expect(page.getByRole("alert").filter({hasText:"not available to your role"})).toBeVisible();await expect(page.getByRole("button",{name:"Create party",exact:true})).toHaveCount(0);
 }finally{await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});await db.customFieldValue.deleteMany({where:{companyId,definitionId:fieldId}});await db.customFieldDefinition.delete({where:{id:fieldId}});await db.customer.deleteMany({where:{companyId,name}});await db.branch.deleteMany({where:{id:{in:[branch,foreign]}}})}
});

test("A052 expense list preserves explicit branch filters and safely denies Data Entry", async ({page}) => {
 test.setTimeout(120000);
 const second=randomUUID(), category=randomUUID(), ledger=randomUUID(), ids=[randomUUID(),randomUUID()];
 const originalSettings=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 await db.branch.create({data:{id:second,companyId,name:"Expense second branch",code:"A052-SECOND"}});
 await db.ledgerAccount.create({data:{id:ledger,companyId,code:"A052-SCOPE",name:"Expense scope fixture",accountClass:"EXPENSE",normalBalance:"DEBIT",allowPosting:true}});
 await db.expenseCategory.create({data:{id:category,companyId,name:"Expense scope category",scope:"EXPENSE",defaultLedgerAccountId:ledger}});
 await db.expenseTransaction.createMany({data:ids.map((id,i)=>({id,companyId,branchId:i?second:branchId,categoryId:category,type:"OFFICE_EXPENSE" as const,status:"DRAFT" as const,transactionNumber:`A052-SCOPE-${i}`,transactionDate:new Date("2026-10-13"),taxableAmount:"10",totalAmount:"10",createdById:userId}))});
 try {
  await signInSettings(page);
  await page.goto(`/workspace/account/expenses?branchId=${second}`);
  await expect(page.getByRole("link",{name:"A052-SCOPE-1",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"A052-SCOPE-0",exact:true})).toHaveCount(0);
  await page.getByRole("link",{name:"Manage categories",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`categories\\?branchId=${second}`));
  await expect(page.getByRole("heading",{name:"Posted totals · Expense second branch · all history",exact:true})).toBeVisible();
  await page.getByLabel("Search categories",{exact:true}).fill("Expense scope");
  await page.getByRole("button",{name:"Search",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`branchId=${second}`));
  await page.goto(`/workspace/account/expenses?branchId=${second}`);
  await page.getByLabel("Search expenses",{exact:true}).fill("no-matching-expense");
  await page.getByRole("button",{name:"Apply filters",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`branchId=${second}`));
  await expect(page.getByRole("link",{name:"Add an expense",exact:true})).toHaveAttribute("href",`/workspace/account/expenses/new?branchId=${second}`);
  await page.goto("/workspace/account/expenses?scope=all");
  await expect(page.getByRole("link",{name:"A052-SCOPE-0",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"A052-SCOPE-1",exact:true})).toBeVisible();
  await db.user.update({where:{id:userId},data:{accountRole:"DATA_ENTRY"}});
  await page.goto("/workspace/account/expenses");
  await expect(page.getByRole("heading",{name:"Expenses access unavailable",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:/A052-SCOPE/})).toHaveCount(0);
  await db.user.update({where:{id:userId},data:{accountRole:"PROJECT_MANAGER"}});
  await db.accountSettings.update({where:{companyId},data:{enabledModules:[]}});
  await page.goto("/workspace/account/expenses");
  await expect(page.getByRole("heading",{name:"Expenses access unavailable",exact:true})).toBeVisible();
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS","PROJECT_COSTING"]}});
  await page.goto(`/workspace/account/expenses?branchId=${branchId}`);
  await expect(page.getByRole("heading",{name:"Expenses",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:/A052-SCOPE/})).toHaveCount(0);

 } finally {
  await db.accountSettings.update({where:{companyId},data:{enabledModules:originalSettings.enabledModules}});
  await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});
  await db.expenseTransaction.deleteMany({where:{id:{in:ids},companyId}});
  await db.expenseCategory.delete({where:{id:category}});
  await db.ledgerAccount.delete({where:{id:ledger}});
  await db.branch.delete({where:{id:second}});
 }
});

test("A082 quotation creation filters and resets customers when branch changes",async({page})=>{
 test.setTimeout(120000);
 const second=randomUUID(),secondCustomer=randomUUID();
 await db.branch.create({data:{id:second,companyId,name:"Quotation second branch",code:"A082-SECOND"}});
 await db.customer.create({data:{id:secondCustomer,companyId,branchId:second,name:"Quotation second customer",isAccountCustomer:true}});
 await signInSettings(page);
 await page.goto("/workspace/account/quotations/new");
 const identity=page.getByRole("group",{name:"Document",exact:true});
 const branch=identity.getByRole("combobox",{name:"Branch",exact:true}),customer=identity.getByRole("combobox",{name:"Customer",exact:true});
 await branch.selectOption(branchId);await customer.selectOption(customerId);
 await branch.selectOption(second);
 await expect(customer).toHaveValue("");
 await expect(customer.locator(`option[value="${customerId}"]`)).toHaveCount(0);
 await expect(customer.locator(`option[value="${secondCustomer}"]`)).toHaveCount(1);
 await customer.selectOption(secondCustomer);
 await page.getByRole("textbox",{name:"Item name",exact:true}).fill("Branch selection check");
 await page.getByRole("spinbutton",{name:"Rate",exact:true}).fill("10");
 const failSave=async(route: import("@playwright/test").Route)=>{if(route.request().method()==="POST")await route.abort("failed");else await route.continue()};
 const retryKey=await page.locator('input[name="creationRequestKey"]').inputValue();
 await page.route("**/workspace/account/quotations/new",failSave);
 await page.getByRole("button",{name:"Save & New",exact:true}).click();
 await expect(page.getByRole("alert").filter({hasText:"No save was confirmed"})).toBeVisible();
 await expect(page.getByRole("textbox",{name:"Item name",exact:true})).toHaveValue("Branch selection check");
 expect(await page.locator('input[name="creationRequestKey"]').inputValue()).toBe(retryKey);
 await expect(branch).toHaveValue(second);await expect(customer).toHaveValue(secondCustomer);
 expect(await db.quotationDocument.count({where:{companyId,creationRequestKey:retryKey}})).toBe(0);
 await page.unroute("**/workspace/account/quotations/new",failSave);
 const originalKey=await page.locator('input[name="creationRequestKey"]').inputValue();
 await page.getByRole("button",{name:"Save & New",exact:true}).click();
 await expect(page.getByRole("status").filter({hasText:"New quotation ready"})).toBeVisible();
 await expect(customer).toHaveValue("");await expect(branch).toHaveValue(second);
 await expect(page.getByRole("textbox",{name:"Item name",exact:true})).toHaveValue("");
 expect(await page.locator('input[name="creationRequestKey"]').inputValue()).not.toBe(originalKey);
 const first=await db.quotationDocument.findFirstOrThrow({where:{companyId,creationRequestKey:originalKey}});
 await customer.selectOption(secondCustomer);
 await page.getByRole("textbox",{name:"Item name",exact:true}).fill("Second saved quotation");
 await page.getByRole("spinbutton",{name:"Rate",exact:true}).fill("20");
 await page.getByRole("button",{name:"Save",exact:true}).click();
 await expect(page).toHaveURL(/\/quotations\/[0-9a-f-]+\/preview$/,{timeout:20000});
 await expect(page.getByRole("region",{name:"Saved document preview"})).toContainText("Second saved quotation");
 const savedId=page.url().split("/").at(-2)!;
 const created=await db.quotationDocument.findUniqueOrThrow({where:{id:savedId}});
 expect(created.documentNumber).not.toBe(first.documentNumber);
 await page.getByRole("link",{name:"Close preview",exact:true}).click();
 await expect(page).toHaveURL(/\/quotations$/);
 expect((await db.quotationDocument.findUniqueOrThrow({where:{id:savedId}})).status).toBe("DRAFT");
 expect(created.status).toBe("DRAFT");
 const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
 await expect(createQuotationForActor(actor,{branchId:second,customerId,documentType:"QUOTATION",issueDate:"2026-10-13",lines:[{lineType:"CUSTOM",itemName:"Wrong branch",quantity:"1",rate:"1"}]})).rejects.toThrow("INVALID_CUSTOMER");
});

test("A067 loan identity creation opens scoped detail and ledger statement",async({page})=>{
 test.setTimeout(90000);
 const {createMoneyAccountForActor}=await import("../src/lib/account/money");
 const actor={id:userId,name:"Admin",email,companyId,role:"COMPANY_ADMIN",accountRole:"ACCOUNT_ADMIN",salesRole:"PRIMARY_ADMIN",isActive:true,accountAccessActive:true,salesAccessActive:true,managerType:null,branchAccessScope:"ALL_BRANCHES",branchIds:[]} as ProjectActor;
 await db.financialYear.create({data:{companyId,name:"Loan browser year",startDate:new Date("2032-01-01"),endDate:new Date("2032-12-31")}});
 await db.ledgerAccount.create({data:{companyId,code:"A067-EXP",name:"Loan expenses",accountClass:"EXPENSE",normalBalance:"DEBIT",systemKey:"GENERAL_EXPENSES"}});
 const account=await createMoneyAccountForActor(actor,{branchId,type:"BANK",name:"A067 Loan Bank",creationRequestKey:randomUUID()});
 await signInSettings(page);await page.goto(`/workspace/account/money/loans?branchId=${branchId}`);
 const empty=page.getByRole("region",{name:"Loan empty state",exact:true});await expect(empty).toContainText("No loans yet");await empty.getByRole("link",{name:"Add Loan",exact:true}).click();await expect(page).toHaveURL(/#loan-entry$/);expect((await new AxeBuilder({page}).include(".employees-content").analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const form=page.locator("form").filter({has:page.getByRole("button",{name:"Create and receive loan",exact:true})});
 await form.getByLabel("Loan name",{exact:true}).fill("A067 Project loan");await form.getByLabel("Loan account number",{exact:true}).fill("A067-ACCOUNT");await form.getByLabel("Description",{exact:true}).fill("Working capital");await form.getByLabel("Duration (months)",{exact:true}).fill("60");await form.getByLabel("Lender",{exact:true}).fill("A067 Lender");
 await form.locator("select[name=branchId]").selectOption(branchId);await form.locator("select[name=moneyAccountId]").selectOption(account.id);await form.locator("input[name=loanType]").fill("TERM");await form.locator("input[name=principal]").fill("100000");await form.locator("input[name=startDate]").fill("2032-01-01");await form.getByRole("button",{name:"Create and receive loan"}).click();
 await expect.poll(()=>db.loan.count({where:{companyId,loanAccountNumber:"A067-ACCOUNT"}}),{timeout:20000}).toBe(1);
 await page.getByLabel("Search loans").fill("no-matching-loan-reference");await page.getByRole("button",{name:"Apply loan filters",exact:true}).click();await expect(empty).toContainText("No loans match these filters");await empty.getByRole("link",{name:"Clear loan filters",exact:true}).click();await expect(page.getByRole("link",{name:"A067 Project loan · TERM"})).toBeVisible();
 await page.getByLabel("Search loans").fill("A067-ACCOUNT");await page.getByRole("button",{name:"Apply loan filters"}).click();await page.getByRole("link",{name:"A067 Project loan · TERM"}).click();
 await expect(page.locator("dl")).toContainText("Working capital",{timeout:20000});await expect(page.locator("dl")).toContainText("A067-ACCOUNT");await expect(page.locator("dl")).toContainText("60");await expect(page.getByRole("region",{name:"Loan statement"})).toContainText("LOAN RECEIPT");await expect(page.getByRole("region",{name:"Loan statement"})).toContainText("1,00,000.00");expect((await new AxeBuilder({page}).include(".employees-content").analyze()).violations).toEqual([]);
 await page.goto(`/workspace/account/money/loans?branchId=${branchId}`);const paymentForm=page.locator("form").filter({has:page.getByRole("button",{name:"Post EMI/payment",exact:true})});const loan=await db.loan.findFirstOrThrow({where:{companyId,loanAccountNumber:"A067-ACCOUNT"}});
 await paymentForm.getByLabel("Loan to repay",{exact:true}).selectOption(loan.id);await paymentForm.getByLabel("Payment account",{exact:true}).selectOption(account.id);await paymentForm.getByLabel("Payment date",{exact:true}).fill("2032-01-02");await paymentForm.getByLabel("Principal paid",{exact:true}).fill("100001");await paymentForm.getByLabel("Interest paid",{exact:true}).fill("550");await paymentForm.getByLabel("Payment description",{exact:true}).fill("October EMI");await paymentForm.getByRole("button",{name:"Post EMI/payment"}).click();await expect(paymentForm.getByRole("alert")).toContainText("cannot exceed",{timeout:20000});await expect(paymentForm.getByLabel("Payment description",{exact:true})).toHaveValue("October EMI");
 const repaymentKey=await paymentForm.locator('input[name="idempotencyKey"]').inputValue();
 const abortRepayment=async(route: import("@playwright/test").Route)=>{if(route.request().method()==="POST")await route.abort("failed");else await route.continue()};
 await page.route("**/workspace/account/money/loans?*",abortRepayment);
 await paymentForm.getByLabel("Principal paid",{exact:true}).fill("2000");await paymentForm.getByRole("button",{name:"Post EMI/payment"}).click();
 await expect(paymentForm.getByRole("alert")).toContainText("Connection interrupted");
 await expect(paymentForm.getByLabel("Payment description",{exact:true})).toHaveValue("October EMI");
 await expect(paymentForm.getByLabel("Principal paid",{exact:true})).toHaveValue("2000");
 await expect(paymentForm.getByLabel("Loan to repay",{exact:true})).toHaveValue(loan.id);
 await expect(paymentForm.locator('input[name="idempotencyKey"]')).toHaveValue(repaymentKey);
 await page.unroute("**/workspace/account/money/loans?*",abortRepayment);
 await paymentForm.getByLabel("Principal paid",{exact:true}).fill("2000");await expect(paymentForm.getByRole("status").filter({hasText:"Payment total"})).toContainText("2,550.00");await paymentForm.getByRole("button",{name:"Post EMI/payment"}).click();await expect(paymentForm.getByRole("status").filter({hasText:"Loan payment posted"})).toBeVisible({timeout:20000});await expect(paymentForm.getByLabel("Principal paid",{exact:true})).toHaveValue("0");await expect(paymentForm.getByLabel("Interest paid",{exact:true})).toHaveValue("0");await expect(paymentForm.getByLabel("Payment description",{exact:true})).toHaveValue("");await expect(paymentForm.getByLabel("Loan to repay",{exact:true})).toHaveValue("");await expect(paymentForm.locator('input[name="idempotencyKey"]')).not.toHaveValue(repaymentKey);await expect(paymentForm.getByRole("status").filter({hasText:"Payment total"})).toContainText("0.00");expect((await new AxeBuilder({page}).include(".employees-content").analyze()).violations).toEqual([]);
 await page.getByRole("link",{name:"A067 Project loan · TERM"}).click();await expect(page.locator("dl")).toContainText("98,000.00",{timeout:20000});await expect(page.getByRole("region",{name:"Loan statement"})).toContainText("October EMI");await expect(page.getByRole("region",{name:"Loan statement"})).toContainText("2,550.00");

 const journalsBefore=await db.journalEntry.count({where:{companyId}});const metadata=page.locator("section[aria-label='Edit loan details']");
 await metadata.getByLabel("Loan name",{exact:true}).fill("A067 Edited loan");await metadata.getByLabel("Description",{exact:true}).fill("Updated loan details");await metadata.getByRole("button",{name:"Save loan details"}).click();await expect(metadata.getByRole("status")).toContainText("Loan details saved",{timeout:20000});await expect(page.getByRole("heading",{name:"A067 Edited loan",exact:true})).toBeVisible({timeout:20000});expect(await db.journalEntry.count({where:{companyId}})).toBe(journalsBefore);expect(await db.loanOperation.count({where:{companyId,loanId:loan.id,action:"EDIT_METADATA"}})).toBe(1);await expect(page.locator("dl")).toContainText("98,000.00");
 const topup=page.locator("section[aria-label='Receive loan top-up']");await topup.getByLabel("Top-up amount",{exact:true}).fill("1000");await topup.getByLabel("Top-up date",{exact:true}).fill("2032-01-03");await topup.getByLabel("Receive top-up into account",{exact:true}).selectOption(account.id);await topup.getByRole("button",{name:"Receive top-up",exact:true}).click();await expect(topup.getByRole("status")).toContainText("Loan top-up received",{timeout:20000});await expect(page.locator("dl")).toContainText("99,000.00",{timeout:20000});expect(await db.loanOperation.count({where:{companyId,loanId:loan.id,action:"TOP_UP"}})).toBe(1);await expect(topup.getByLabel("Top-up amount",{exact:true})).toHaveValue("");await expect(topup.getByLabel("Receive top-up into account",{exact:true})).toHaveValue("");
 const lifecycle=page.locator("section[aria-label='Loan lifecycle']");await lifecycle.getByLabel("Loan action",{exact:true}).selectOption("CANCEL");await lifecycle.getByLabel("Correction date",{exact:true}).fill("2032-01-04");await lifecycle.getByLabel("Reason",{exact:true}).fill("Receipt entered in error");await lifecycle.getByRole("button",{name:"Update loan history",exact:true}).click();await expect(lifecycle.getByRole("alert")).toContainText("payments, top-ups",{timeout:20000});await expect(lifecycle.getByLabel("Reason",{exact:true})).toHaveValue("Receipt entered in error");expect((await new AxeBuilder({page}).include(".employees-content").analyze()).violations).toEqual([]);

});

test("A067 loan readers see balances without receipt or EMI mutation controls",async({page})=>{
 await signInSettings(page);
 try{
  await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNTANT"}});
  await page.goto(`/workspace/account/money/loans?branchId=${branchId}`);
  await expect(page.getByRole("heading",{name:"Loans & EMI",exact:true})).toBeVisible({timeout:20000});
  await expect(page.getByRole("button",{name:"Create and receive loan",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Post EMI/payment",exact:true})).toHaveCount(0);
  await expect(page.getByRole("textbox",{name:"Search loans",exact:true})).toBeVisible();
 }finally{await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});}
});

test("A064 bank metadata validates, edits and controls selected invoice output",async({page})=>{
 test.setTimeout(90000);
 await signInSettings(page);await page.goto(`/workspace/account/money/accounts?branchId=${branchId}`);
 const form=page.locator("form").filter({has:page.getByRole("button",{name:"Create account and asset ledger",exact:true})});
 await form.getByLabel("Account type",{exact:true}).selectOption("CASH");await expect(form.getByLabel("Bank name",{exact:true})).toBeHidden();await expect(form.getByLabel("UPI ID",{exact:true})).toBeDisabled();await form.getByLabel("Account type",{exact:true}).selectOption("BANK");
 await form.getByLabel("Account display name",{exact:true}).fill("A064 Metadata Browser Bank");await form.getByLabel("Branch",{exact:true}).selectOption(branchId);await form.getByLabel("Bank name",{exact:true}).fill("A064 Bank");await form.getByLabel("Account holder name",{exact:true}).fill("A064 Holder");await form.getByLabel("Bank branch name",{exact:true}).fill("A064 Main");await form.getByLabel("Masked account number",{exact:true}).fill("****1234");await form.getByLabel("IFSC",{exact:true}).fill("BAD");await form.getByRole("button",{name:"Create account and asset ledger"}).click();await expect(form.getByRole("alert").filter({hasText:"IFSC must contain"})).toBeVisible({timeout:20000});await expect(form.getByLabel("IFSC",{exact:true})).toBeFocused();await expect(form.getByLabel("Account holder name",{exact:true})).toHaveValue("A064 Holder");
 await form.getByLabel("IFSC",{exact:true}).fill("SBIN0001234");await form.getByLabel("UPI ID",{exact:true}).fill("holder@bank");await form.getByLabel("Print bank details on invoices",{exact:true}).check();await form.getByLabel("Print payment QR on invoices",{exact:true}).check();await form.getByRole("button",{name:"Create account and asset ledger"}).click();await expect(form.getByRole("status")).toContainText("Money account created",{timeout:20000});
 const bank=await db.moneyAccount.findFirstOrThrow({where:{companyId,name:"A064 Metadata Browser Bank"}});expect(bank).toMatchObject({accountHolderName:"A064 Holder",bankBranchName:"A064 Main",upiId:"holder@bank",printBankDetails:true,printUpiQr:true});
 await page.goto(`/workspace/account/money/accounts/${bank.id}?branchId=${branchId}`);const edit=page.locator("form").filter({has:page.getByRole("button",{name:"Save account details",exact:true})});await expect(edit.getByLabel("Account holder name",{exact:true})).toHaveValue("A064 Holder");await edit.getByLabel("Account holder name",{exact:true}).fill("A064 Updated Holder");await edit.getByRole("button",{name:"Save account details"}).click();await expect(edit.getByRole("status")).toContainText("Account details saved",{timeout:20000});expect((await new AxeBuilder({page}).include(".employees-content").analyze()).violations).toEqual([]);
 await page.goto("/workspace/account/settings/print-templates");await page.getByLabel("Invoice bank account",{exact:true}).selectOption(bank.id);await page.getByRole("button",{name:"Save Invoice Print Settings"}).click();await expect(page.getByRole("status").filter({hasText:"Saved successfully"})).toBeVisible({timeout:20000});
 const token=createSessionToken(),sessionUser=await db.user.findUniqueOrThrow({where:{id:userId}});await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:sessionUser.sessionVersion}});
 const options=await page.request.get("/api/v1/mobile/account/settings",{headers:{authorization:`Bearer ${token}`}});expect(options.status()).toBe(200);expect((await options.json()).invoiceBanks).toContainEqual({id:bank.id,name:bank.name});
 const mobile=await page.request.get(`/api/v1/mobile/account/print/SALES_INVOICE/${printDocumentId}`,{headers:{authorization:`Bearer ${token}`}});expect(mobile.status()).toBe(200);expect((await extractPdfText(await mobile.body())).text).toContain("A064 Updated Holder");
 const print=await page.request.get(`/api/account/print/SALES_INVOICE/${printDocumentId}`);expect(print.status()).toBe(200);expect(await print.text()).toContain("A064 Updated Holder");const pdf=await page.request.get(`/api/account/print/SALES_INVOICE/${printDocumentId}?format=pdf`);expect(pdf.status()).toBe(200);expect((await extractPdfText(await pdf.body())).text).toContain("A064 Updated Holder");
 await page.goto(`/workspace/account/money/accounts/${bank.id}?branchId=${branchId}`);const off=page.locator("form").filter({has:page.getByRole("button",{name:"Save account details",exact:true})});await off.getByLabel("Print bank details on invoices",{exact:true}).uncheck();await off.getByLabel("Print payment QR on invoices",{exact:true}).uncheck();await off.getByRole("button",{name:"Save account details"}).click();await expect(off.getByRole("status")).toContainText("Account details saved",{timeout:20000});const hidden=await page.request.get(`/api/account/print/SALES_INVOICE/${printDocumentId}`);expect(await hidden.text()).not.toContain("A064 Updated Holder");expect(await hidden.text()).not.toContain("holder%40bank");
});

test("A083 estimate list supports empty state, grouped search, cards and estimate creation at this viewport",async({page})=>{
 test.setTimeout(90000);await db.accountSettings.update({where:{companyId},data:{enabledModules:["ASSETS","QUOTATIONS_BOQ"]}});
 await signInSettings(page);await page.goto("/workspace/account/quotations");await expect(page.getByRole("heading",{name:"Estimate Details",exact:true})).toBeVisible({timeout:20000});await expect(page.getByRole("heading",{name:"No estimates yet",exact:true})).toBeVisible();
 await page.getByRole("link",{name:"Add Estimate",exact:true}).first().click();await expect(page.getByLabel("Document type",{exact:true})).toHaveValue("ESTIMATE",{timeout:20000});
 const actor={id:userId,name:"Admin",email,companyId,role:"COMPANY_ADMIN",accountRole:"ACCOUNT_ADMIN",salesRole:"PRIMARY_ADMIN",isActive:true,accountAccessActive:true,salesAccessActive:true,managerType:null,branchAccessScope:"ALL_BRANCHES",branchIds:[]} as ProjectActor;
 const input={branchId,customerId,documentType:"ESTIMATE",issueDate:"2026-10-13",lines:[{lineType:"CUSTOM",itemName:"Estimate line",quantity:"1",rate:"100",taxRate:"18"}]};const open=await createQuotationForActor(actor,input),closed=await createQuotationForActor(actor,input);await transitionQuotationForActor(actor,closed.id,"CANCELLED");
 await page.goto("/workspace/account/quotations");await expect(page.locator(".estimate-card")).toHaveCount(2);await expect(page.locator(".estimate-card").first()).toContainText("Print fixture customer");await expect(page.locator(".estimate-card").first()).toContainText("118.00");
 await page.getByRole("navigation",{name:"Estimate status"}).getByRole("link",{name:"Open",exact:true}).click();await expect(page.locator(".estimate-card")).toHaveCount(1);await expect(page.locator(".estimate-card")).toContainText(open.documentNumber);
 await page.getByRole("navigation",{name:"Estimate status"}).getByRole("link",{name:"Closed",exact:true}).click();await expect(page.locator(".estimate-card")).toHaveCount(1);await expect(page.locator(".estimate-card")).toContainText(closed.documentNumber);
 await page.getByRole("navigation",{name:"Estimate status"}).getByRole("link",{name:"All",exact:true}).click();await expect(page.getByRole("navigation",{name:"Estimate status"}).getByRole("link",{name:"All",exact:true})).toHaveAttribute("aria-current","page");await page.getByLabel("Search estimates",{exact:true}).fill(open.documentNumber.toLowerCase());await page.getByRole("button",{name:"Search",exact:true}).click();await expect(page.locator(".estimate-card")).toHaveCount(1);expect((await new AxeBuilder({page}).include(".estimate-list").analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByLabel("Search estimates",{exact:true}).fill("no matching estimate");await page.getByRole("button",{name:"Search",exact:true}).click();await expect(page.getByRole("heading",{name:"No matching estimates",exact:true})).toBeVisible();expect((await new AxeBuilder({page}).include(".estimate-list").analyze()).violations).toEqual([]);
});

test("A097 filtered saves and printer switches retain hidden print preferences",async({page})=>{
 test.setTimeout(90000);const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});const retained={printer:"REGULAR",theme:"MINIMAL",orientation:"LANDSCAPE",pageSize:"A4",printCompanyName:true,email:false,phone:true,topSpace:5,minRows:9,termsText:"Retained custom terms",customSignatureText:"Retained signature",bankAccountId:""};
 try{
  await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{...(original.transactionDefaults as object??{}),invoicePrintSettings:retained}}});await signInSettings(page);await page.goto("/workspace/account/settings/print-templates");
  page.once("dialog",dialog=>dialog.accept("company name"));await page.getByRole("button",{name:"Search",exact:true}).click();await page.locator('input[name="printCompanyName"]').uncheck();await expect(page.locator('input[name="email"]')).not.toBeVisible();await page.getByRole("button",{name:"Save Invoice Print Settings",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible({timeout:20000});
  let saved=(await db.accountSettings.findUniqueOrThrow({where:{companyId}})).transactionDefaults as {invoicePrintSettings:Record<string,unknown>};expect(saved.invoicePrintSettings).toMatchObject({...retained,printCompanyName:false});
  page.once("dialog",dialog=>dialog.accept(""));await page.getByRole("button",{name:"Search",exact:true}).click();await expect(page.locator('input[name="email"]')).toBeVisible();await expect(page.locator('input[name="email"]')).not.toBeChecked();await page.getByRole("button",{name:"Thermal",exact:true}).click();
  page.once("dialog",dialog=>dialog.accept("page size"));await page.getByRole("button",{name:"Search",exact:true}).click();await page.locator('select[name="pageSize"]').selectOption("A5");await page.getByRole("button",{name:"Save Invoice Print Settings",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible({timeout:20000});await page.reload();
  saved=(await db.accountSettings.findUniqueOrThrow({where:{companyId}})).transactionDefaults as {invoicePrintSettings:Record<string,unknown>};expect(saved.invoicePrintSettings).toMatchObject({...retained,printCompanyName:false,printer:"THERMAL",pageSize:"A5"});await expect(page.locator('input[name="termsText"]')).toHaveValue("Retained custom terms");await expect(page.locator('input[name="customSignatureText"]')).toHaveValue("Retained signature");await expect(page.locator('input[name="topSpace"]')).toHaveValue("5");await expect(page.locator('input[name="minRows"]')).toHaveValue("9");
  await page.getByRole("button",{name:"Regular",exact:true}).click();await page.getByRole("button",{name:"Save Invoice Print Settings",exact:true}).click();await expect(page.getByText("Saved successfully",{exact:true})).toBeVisible({timeout:20000});expect(((await db.accountSettings.findUniqueOrThrow({where:{companyId}})).transactionDefaults as {invoicePrintSettings:Record<string,unknown>}).invoicePrintSettings).toMatchObject({...retained,printCompanyName:false,pageSize:"A5"});
 }finally{await db.accountSettings.update({where:{companyId},data:{transactionDefaults:original.transactionDefaults??{}}});}
});

test("A062 Unit to Items assigns inline units and retains inputs on historical-unit rejection",async({page})=>{
 test.setTimeout(90000);await db.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:true,itemUnits:true}}});
 const fresh=await db.accountProduct.create({data:{companyId,name:"A062 Assignment fresh",salePrice:"10"}}),unit=await db.accountUnit.create({data:{companyId,name:"A062 historical base",symbol:"HBASE"}}),used=await db.accountProduct.create({data:{companyId,name:"A062 Assignment recorded",unitId:unit.id,salePrice:"10"}});
 const actor={id:userId,name:"Admin",email,companyId,role:"COMPANY_ADMIN",accountRole:"ACCOUNT_ADMIN",salesRole:"PRIMARY_ADMIN",isActive:true,accountAccessActive:true,salesAccessActive:true,managerType:null,branchAccessScope:"ALL_BRANCHES",branchIds:[]} as ProjectActor;await createQuotationForActor(actor,{branchId,customerId,documentType:"QUOTATION",issueDate:"2026-10-13",lines:[{lineType:"PRODUCT",sourceId:used.id,quantity:"2",rate:"10"}]});
 await signInSettings(page);await page.goto("/workspace/account/inventory/units");await page.getByRole("button",{name:"Unit to Items",exact:true}).click();const assignment=page.getByRole("dialog",{name:"Unit to Items",exact:true});await assignment.getByLabel("Search assignment items",{exact:true}).fill("A062 Assignment fresh");await assignment.getByLabel("Select A062 Assignment fresh",{exact:true}).check();await assignment.getByLabel("Create a unit inline",{exact:true}).check();await assignment.getByLabel("Full Unit Name",{exact:true}).fill("A062 Inline box");await assignment.getByLabel("Short Name",{exact:true}).fill("IBOX");expect((await new AxeBuilder({page}).include(".items-manager-page").analyze()).violations).toEqual([]);await assignment.getByRole("button",{name:"Assign unit",exact:true}).click();await expect(assignment).not.toBeVisible({timeout:20000});await expect(page.getByRole("status").filter({hasText:"Assigned unit to 1 items."})).toBeVisible();
 const created=await db.accountUnit.findFirstOrThrow({where:{companyId,name:"A062 Inline box"}});expect((await db.accountProduct.findUniqueOrThrow({where:{id:fresh.id}})).unitId).toBe(created.id);
 await page.getByRole("button",{name:"Unit to Items",exact:true}).click();await assignment.getByLabel("Search assignment items",{exact:true}).fill("A062 Assignment recorded");await assignment.getByLabel("Select A062 Assignment recorded",{exact:true}).check();await assignment.getByLabel("Assignment unit",{exact:true}).selectOption(created.id);await assignment.getByRole("button",{name:"Assign unit",exact:true}).click();await expect(assignment.getByRole("alert")).toContainText("stock or document quantities",{timeout:20000});await expect(assignment.getByLabel("Select A062 Assignment recorded",{exact:true})).toBeChecked();await expect(assignment.getByLabel("Assignment unit",{exact:true})).toHaveValue(created.id);expect((await db.accountProduct.findUniqueOrThrow({where:{id:used.id}})).unitId).toBe(unit.id);expect((await new AxeBuilder({page}).include(".items-manager-page").analyze()).violations).toEqual([]);await assignment.getByRole("button",{name:"Cancel",exact:true}).click();await expect(assignment).not.toBeVisible();
});

test("A071 Home shares the selected PDF, honors saved default and reports failure",async({page})=>{
 test.setTimeout(120_000);
 const id=randomUUID();await db.commercialDocument.create({data:{id,companyId,branchId,type:"SALES_ORDER",status:"DRAFT",documentNumber:"HOME-SHARE-71",customerId,partyId:customerId,partyName:"Home share fixture",issueDate:new Date("2026-10-11"),subtotal:"100",taxableTotal:"100",taxTotal:"0",grandTotal:"100",balanceDue:"100",createdById:userId}});
 const setDefault=async(shareAs:string)=>{const row=await db.accountSettings.findUniqueOrThrow({where:{companyId}});const defaults=row.transactionDefaults as Record<string,unknown>|null;await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{...defaults,transactionPreferences:{shareAs}}}})};
 await setDefault("PDF");await signInSettings(page);
 const mobileToken=createSessionToken(),mobileUser=await db.user.findUniqueOrThrow({where:{id:userId}});
 await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(mobileToken),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:mobileUser.sessionVersion}});
 const mobileHeaders={authorization:`Bearer ${mobileToken}`};
 const pdfDefault=await page.request.get("/api/v1/mobile/account/home",{headers:mobileHeaders});expect(pdfDefault.status()).toBe(200);expect((await pdfDefault.json()).shareAs).toBe("PDF");await page.goto("/workspace/account?q=Home%20share%20fixture");
 await page.evaluate(()=>{Object.defineProperty(navigator,"share",{configurable:true,value:undefined});});
 const download=page.waitForEvent("download");await page.getByRole("button",{name:"Share",exact:true}).click();expect((await download).suggestedFilename()).toBe("HOME-SHARE-71.pdf");
 await setDefault("ASK");const askDefault=await page.request.get("/api/v1/mobile/account/home",{headers:mobileHeaders});expect(askDefault.status()).toBe(200);expect((await askDefault.json()).shareAs).toBe("ASK");await page.reload();let requests=0;await page.route(`**/api/account/print/SALES_ORDER/${id}?format=pdf`,async route=>{requests++;await route.fulfill({status:403,contentType:"text/plain",body:"Forbidden"})});
 await page.getByRole("button",{name:"Share",exact:true}).click();expect(requests).toBe(0);await page.getByRole("button",{name:"Share as PDF",exact:true}).click();await expect(page.getByRole("dialog").getByRole("alert")).toContainText("permission");expect(requests).toBe(1);await expect(page.getByRole("button",{name:"Share as PDF",exact:true})).toBeEnabled();
 await page.unroute(`**/api/account/print/SALES_ORDER/${id}?format=pdf`);
 await page.evaluate(()=>{Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>true});Object.defineProperty(navigator,"share",{configurable:true,value:()=>Promise.reject(new DOMException("Cancelled","AbortError"))});});
 await page.getByRole("button",{name:"Share as PDF",exact:true}).click();await expect(page.getByRole("button",{name:"Share as PDF",exact:true})).toBeEnabled();await expect(page.getByRole("dialog").getByRole("alert")).toHaveCount(0);
 await page.evaluate(()=>{Object.defineProperty(navigator,"share",{configurable:true,value:undefined});});
 const imageDownload=page.waitForEvent("download");await page.getByRole("button",{name:"Share as Image",exact:true}).click();const image=await imageDownload;expect(image.suggestedFilename()).toBe("HOME-SHARE-71.png");
 const path=await image.path();expect(path).toBeTruthy();const {readFile}=await import("node:fs/promises");const bytes=await readFile(path!);expect(bytes.subarray(1,4).toString()).toBe("PNG");expect(bytes.length).toBeGreaterThan(1000);
 const multi=await PDFDocument.create();multi.addPage([300,400]).drawText("Image page one");multi.addPage([300,400]).drawText("Image page two");const multiBytes=Buffer.from(await multi.save());
 await page.route(`**/api/account/print/SALES_ORDER/${id}?format=pdf`,route=>route.fulfill({status:200,contentType:"application/pdf",body:multiBytes}));
 await page.getByRole("button",{name:"Share as Image",exact:true}).click();await expect(page.getByRole("button",{name:"Download page 1",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Download page 2",exact:true})).toBeVisible();
});

test("A071 Duplicate opens an independent new Sale without copying its payment or posting on open",async({page})=>{
 test.setTimeout(120_000);
 await db.accountSettings.update({where:{companyId},data:{enabledModules:["SALES","CUSTOMER_RECEIPTS","INVENTORY"]}});
 if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Duplicate verification",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
 for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
 const user=await db.user.findUniqueOrThrow({where:{id:userId}}),actor={...user,companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
 const source=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",branchId,partyId:customerId,billingName:"Original billing",issueDate:"2026-10-11",lines:[{lineType:"CUSTOM",itemName:"Duplicate verification",quantity:"1",rate:"100",taxRate:"0"}]});
 await postCommercialDocumentForActor(actor,{documentId:source.id});
 await createSettlementForActor(actor,{idempotencyKey:randomUUID(),type:"CUSTOMER_RECEIPT",branchId,partyId:customerId,paymentMode:"CASH",amount:"100",transactionDate:"2026-10-11",allocations:[{documentId:source.id,amount:"100"}]});
 const counts=async()=>({documents:await db.commercialDocument.count({where:{companyId}}),journals:await db.journalEntry.count({where:{companyId}}),allocations:await db.settlementAllocation.count({where:{document:{companyId}}})});
 const before=await counts();await signInSettings(page);await page.goto("/workspace/account?q=Print%20fixture%20customer");await page.getByRole("button",{name:"More",exact:true}).click();await page.getByRole("link",{name:"Duplicate",exact:true}).click();await expect(page).toHaveURL(new RegExp(`duplicateId=${source.id}`),{timeout:20000});await expect(page.getByText("Duplicate verification",{exact:true})).toBeVisible();expect(await counts()).toEqual(before);
 const billing=page.getByLabel(/Billing Name/);await expect(billing).toHaveValue("Original billing");await billing.fill("Copy billing");expect((await db.commercialDocument.findUniqueOrThrow({where:{id:source.id}})).billingName).toBe("Original billing");
 await page.getByRole("button",{name:"Save",exact:true}).click();await expect.poll(async()=>await db.commercialDocument.count({where:{companyId}})).toBe(before.documents+1);
 const copy=await db.commercialDocument.findFirstOrThrow({where:{companyId,billingName:"Copy billing"},include:{allocations:true,advanceApplications:true,lines:true}});expect(copy.id).not.toBe(source.id);expect(copy.documentNumber).not.toBe(source.documentNumber);expect(copy.allocations).toHaveLength(0);expect(copy.advanceApplications).toHaveLength(0);expect(copy.lines[0].id).not.toBe((await db.commercialDocumentLine.findFirstOrThrow({where:{documentId:source.id}})).id);expect((await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,copy.id))).outstanding.toString()).toBe("100");expect((await db.$transaction(tx=>documentOutstandingInTx(tx,companyId,source.id))).outstanding.toString()).toBe("0");
 const missing=await page.request.get(`/workspace/account/transactions/new?type=SALES_INVOICE&duplicateId=${randomUUID()}`);expect(missing.status()).toBe(404);
});

test("A071 Party Home groups rows and preserves long names, dates, scope and empty state",async({page})=>{
 test.setTimeout(120_000);
 const longName="Long party name for grouped rows ".repeat(6).trim();
 await db.customer.update({where:{id:customerId},data:{updatedAt:new Date("2026-10-11T00:00:00Z")}});
 await db.customer.create({data:{companyId,branchId,name:longName,isAccountCustomer:true,updatedAt:new Date("2026-10-11T00:00:00Z")}});
 await signInSettings(page);await page.goto(`/workspace/account?tab=parties&branchId=${branchId}`);
 const panel=page.getByRole("region",{name:"Parties",exact:true});await expect(panel).toHaveClass(/account-party-panel/);await expect(panel.getByRole("link")).toHaveCount(2);await expect(panel.getByText("Last activity 11/10/2026",{exact:true})).toHaveCount(2);
 await expect(page.getByRole("link",{name:"+ Add New Party",exact:true})).toHaveAttribute("href",new RegExp(`customers/new\\?.*branchId=${branchId}`));
 await page.addStyleTag({content:".account-party-panel strong,.account-party-panel small,.account-party-panel .account-money{font-size:2rem!important}"});
 const row=panel.getByRole("link").filter({hasText:longName});await expect(row).toBeVisible();expect(await panel.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
 const axe=await new AxeBuilder({page}).include(".account-party-panel").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();expect(axe.violations).toEqual([]);
 await row.click();await expect(page).toHaveURL(/\/workspace\/account\/customers\?/,{timeout:20000});expect(new URL(page.url()).searchParams.get("branchId")).toBe(branchId);expect(new URL(page.url()).searchParams.get("q")).toBe(longName);
 await page.goto(`/workspace/account?tab=parties&branchId=${branchId}&q=no-matching-party`);await expect(page.getByText("No parties found",{exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"Parties",exact:true}).getByRole("link")).toHaveCount(0);
});

 test("A071 Home payment filter opens the scoped read-only payment destination",async({page})=>{
 test.setTimeout(120000);
 const customer=await db.customer.create({data:{companyId,branchId,name:"Home source payment buyer",isAccountCustomer:true}});
 const user=await db.user.findUniqueOrThrow({where:{id:userId}}),actor={...user,companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
 await db.financialYear.create({data:{companyId,name:"Home source year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
 for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{}});
 const payment=await createSettlementForActor(actor,{type:"CUSTOMER_ADVANCE",branchId,partyId:customer.id,amount:"123.45",paymentMode:"CASH",transactionDate:"2026-10-11",idempotencyKey:randomUUID()});
 const count=await db.journalEntry.count({where:{companyId}});
 await signInSettings(page);
 const mobileToken=createSessionToken(),mobileUser=await db.user.findUniqueOrThrow({where:{id:userId}});
 await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(mobileToken),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:mobileUser.sessionVersion}});
 const headers={authorization:`Bearer ${mobileToken}`},base=`/api/v1/mobile/account/home?branchId=${branchId}&type=CUSTOMER_RECEIPT&q=Home%20source%20payment%20buyer`;
 const legacy=await page.request.get(base,{headers});expect(legacy.status()).toBe(200);expect((await legacy.json()).transactions).toEqual([]);
 const current=await page.request.get(`${base}&homeVersion=2`,{headers});expect(current.status()).toBe(200);expect((await current.json()).transactions).toEqual([expect.objectContaining({id:payment.id,sourceKind:"SETTLEMENT",printType:"CUSTOMER_ADVANCE",balanceLabel:"Unallocated"})]);
 await page.goto(`/workspace/account?branchId=${branchId}&types=CUSTOMER_RECEIPT&q=Home%20source%20payment%20buyer`);
 const card=page.locator(".account-transaction-card").filter({hasText:customer.name});await expect(card).toHaveCount(1);await expect(card).toContainText("123.45");
 await card.getByRole("link").first().click();await expect(page).toHaveURL(new RegExp(`/settlements/${payment.id}`));
 const detail=page.getByRole("region",{name:"Payment details"});await expect(detail).toContainText(customer.name);await expect(detail).toContainText("Unallocated amount");await expect(detail).toContainText("No applications.");
 expect(await db.journalEntry.count({where:{companyId}})).toBe(count);
 const axe=await new AxeBuilder({page}).include('[aria-label="Payment details"]').withTags(["wcag2a","wcag2aa"]).analyze();expect(axe.violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });

test("A064 transfer modes constrain cash and bank sides and preserve the selected branch",async({page})=>{
 test.setTimeout(120000);
 const ids:string[]=[];
 for(const [index,type] of ["BANK","BANK","CASH"].entries()){
  const ledger=await db.ledgerAccount.create({data:{companyId,code:`MODE-${index}`,name:`Transfer mode ${index}`,accountClass:"ASSET",normalBalance:"DEBIT"}});
  const account=await db.moneyAccount.create({data:{companyId,branchId,type:type as "BANK"|"CASH",name:`Transfer mode ${index}`,ledgerAccountId:ledger.id}});ids.push(account.id);
 }
 await db.financialYear.create({data:{companyId,name:"Transfer mode year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
 await signInSettings(page);await page.goto(`/workspace/account/money/transfers?branchId=${branchId}`);
 await expect(page.getByLabel("Branch",{exact:true})).toHaveValue(branchId);
 const financialRequestKey=await page.locator('input[name="idempotencyKey"]').inputValue();
 const from=page.getByLabel("From account",{exact:true}),to=page.getByLabel("To account",{exact:true});
 await expect(from.locator("option")).toHaveCount(3);await expect(to.locator("option")).toHaveCount(2);
 await from.selectOption(ids[0]);await to.selectOption(ids[2]);
 await page.getByRole("radio",{name:"Cash to Bank",exact:true}).check();await expect(from).toHaveValue("");await expect(to).toHaveValue("");await expect(from.locator("option")).toHaveCount(2);await expect(to.locator("option")).toHaveCount(3);
 await page.getByRole("radio",{name:"Bank to Bank",exact:true}).check();await from.selectOption(ids[0]);await expect(to.locator(`option[value="${ids[0]}"]`)).toHaveJSProperty("disabled",true);await to.selectOption(ids[1]);
 await expect(page.locator('input[name="idempotencyKey"]')).toHaveValue(financialRequestKey);
 await page.getByLabel("Amount",{exact:true}).fill("20.25");await page.getByLabel("Description",{exact:true}).fill("Move funds to operating bank");await page.getByLabel("Transfer date",{exact:true}).fill("2026-10-11");
 const sharp=(await import("sharp")).default,pixels=await sharp({create:{width:2,height:2,channels:3,background:"red"}}).png().toBuffer();await page.locator('input[name="image"]').setInputFiles({name:"proof.png",mimeType:"image/png",buffer:pixels});
 await page.getByRole("button",{name:"Post transfer / deposit"}).click();await expect(page.getByRole("status").filter({hasText:"Transfer posted"})).toBeVisible();
 const saved=await db.moneyTransfer.findFirstOrThrow({where:{companyId,sourceAccountId:ids[0],destinationAccountId:ids[1]}});const image=await db.moneyTransferImage.findUniqueOrThrow({where:{transferId:saved.id}});expect(image.displayName).toBe("proof.png");const response=await page.request.get(`/api/account/money/transfers/${saved.id}/image`);expect(response.status()).toBe(200);expect(response.headers()["cache-control"]).toBe("private, no-store");expect(response.headers()["content-type"]).toBe("image/png");expect((await response.body()).subarray(1,4).toString()).toBe("PNG");expect(saved.description).toBe("Move funds to operating bank");expect(saved.amount.toString()).toBe("20.25");const lines=await db.journalLine.findMany({where:{companyId,journalEntryId:saved.journalEntryId}});expect(lines.map(row=>row.debit.toString()).sort()).toEqual(["0","20.25"]);expect(lines.map(row=>row.credit.toString()).sort()).toEqual(["0","20.25"]);
 const mobileToken=createSessionToken(),mobileUser=await db.user.findUniqueOrThrow({where:{id:userId}});await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(mobileToken),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:mobileUser.sessionVersion}});const headers={authorization:`Bearer ${mobileToken}`};
 const payload={branchId,sourceAccountId:ids[1],destinationAccountId:ids[0],amount:"3.50",transferDate:"2026-10-11",idempotencyKey:randomUUID(),description:"Native image transfer",image:{name:"native.png",mimeType:"image/png",base64:pixels.toString("base64")}};
 const first=await page.request.post("/api/v1/mobile/account/money/transfers",{headers,data:payload});expect(first.status()).toBe(201);const native=await first.json(),journalCount=await db.journalEntry.count({where:{companyId}});
 const retry=await page.request.post("/api/v1/mobile/account/money/transfers",{headers,data:payload});expect(retry.status()).toBe(201);expect((await retry.json()).id).toBe(native.id);expect(await db.journalEntry.count({where:{companyId}})).toBe(journalCount);expect(await db.moneyTransferImage.count({where:{companyId,transferId:native.id}})).toBe(1);
 const mobileImage=await page.request.get(`/api/v1/mobile/account/money/transfers/${native.id}/image`,{headers});expect(mobileImage.status()).toBe(200);expect(mobileImage.headers()["cache-control"]).toBe("private, no-store");expect((await mobileImage.body()).subarray(1,4).toString()).toBe("PNG");
 const invalid=await page.request.post("/api/v1/mobile/account/money/transfers",{headers,data:{...payload,idempotencyKey:randomUUID(),image:{name:"bad.png",mimeType:"image/png",base64:Buffer.from("<html/>").toString("base64")}}});expect(invalid.status()).toBe(400);expect(await db.journalEntry.count({where:{companyId}})).toBe(journalCount);
 await page.getByText("Adjust Bank Balance",{exact:true}).click();await page.getByRole("link",{name:"Transfer mode 0",exact:true}).click();await expect(page).toHaveURL(new RegExp(`/money/accounts/${ids[0]}`),{timeout:20000});await expect(page.getByRole("heading",{name:"Add / Reduce balance"})).toBeVisible({timeout:20000});
});

test("A065 asset funding and capital repayment preserve asset cost and scoped navigation",async({page})=>{
 test.setTimeout(180000);
 const year=await db.financialYear.create({data:{companyId,name:"A065 funding year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}}),user=await db.user.findUniqueOrThrow({where:{id:userId}}),actor={...user,companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
 const ledger=async(code:string,accountClass:"ASSET"|"EQUITY"|"LIABILITY",normalBalance:"DEBIT"|"CREDIT")=>db.ledgerAccount.create({data:{companyId,code:`FUND-${code}`,name:`Funding workflow ${code}`,accountClass,normalBalance}});
 const bankLedger=await ledger("BANK","ASSET","DEBIT"),equipment=await ledger("EQUIPMENT","ASSET","DEBIT"),equity=await ledger("EQUITY","EQUITY","CREDIT"),capital=await ledger("CAPITAL","EQUITY","CREDIT"),drawings=await ledger("DRAWINGS","EQUITY","DEBIT"),loan=await ledger("LOAN","LIABILITY","CREDIT");
 const bank=await db.moneyAccount.create({data:{companyId,branchId,type:"BANK",name:"Funding workflow bank",ledgerAccountId:bankLedger.id}}),owner=await db.ownerFinancialAccount.create({data:{companyId,name:"Funding workflow partner",partyType:"PARTNER",capitalLedgerId:capital.id,drawingsLedgerId:drawings.id,loanLedgerId:loan.id}}),asset=await db.asset.create({data:{companyId,branchId,assetNumber:"FUNDING-WEB",name:"Funding workflow equipment",assetType:"EQUIPMENT",purchaseDate:new Date("2026-10-10"),purchaseValue:"40000",assetLedgerId:equipment.id,createdById:userId}});
 const journal=async(lines:Array<{ledgerAccountId:string;debit:string;credit:string}>)=>postJournalForActor(actor,{financialYearId:year.id,branchId,entryDate:"2026-10-10",sourceType:"MANUAL_JOURNAL",sourceId:randomUUID(),postingPurpose:"PRIMARY",lines});
 await journal([{ledgerAccountId:bankLedger.id,debit:"15000",credit:"0"},{ledgerAccountId:equity.id,debit:"0",credit:"15000"}]);
 const investment=await postOwnerTransactionForActor(actor,{ownerFinancialAccountId:owner.id,moneyAccountId:bank.id,branchId,type:"INVESTMENT",amount:"30000",transactionDate:"2026-10-10",idempotencyKey:randomUUID()});
 await journal([{ledgerAccountId:equipment.id,debit:"40000",credit:"0"},{ledgerAccountId:bankLedger.id,debit:"0",credit:"40000"}]);
 await signInSettings(page);await page.goto(`/workspace/account/money?branchId=${branchId}`);await page.getByRole("navigation",{name:"Cash and bank navigation"}).getByRole("link",{name:/Capital/}).click();await expect(page).toHaveURL(new RegExp(`/capital\\?branchId=${branchId}`),{timeout:20000});await page.getByRole("link",{name:"Asset funding",exact:true}).click();await expect(page.getByRole("heading",{name:"Asset funding",exact:true})).toBeVisible({timeout:20000});
 const allocationForm=page.locator("form").filter({has:page.getByRole("heading",{name:"Allocate owner funding",exact:true})});await allocationForm.getByLabel("Retained asset",{exact:true}).selectOption(asset.id);await allocationForm.getByLabel("Owner investment",{exact:true}).selectOption(investment.id);await allocationForm.getByLabel("Owner-funded amount",{exact:true}).fill("30000");await allocationForm.getByLabel("Allocation date",{exact:true}).fill("2026-10-11");await allocationForm.getByLabel("Confirm the remaining asset cost as company-funded",{exact:true}).check();const count=await db.journalEntry.count({where:{companyId}});await allocationForm.getByRole("button",{name:"Record funding",exact:true}).click();await expect(allocationForm.getByRole("status")).toHaveText("Asset funding recorded");expect(await db.journalEntry.count({where:{companyId}})).toBe(count);
 let card=page.getByRole("region",{name:`Funding for ${asset.name}`,exact:true});await expect(card).toContainText("30,000.00");await expect(card).toContainText("10,000.00");
 await page.locator(`a[href="/workspace/account/money/capital?branchId=${branchId}"]`).first().click();const entry=page.locator("form.owner-entry-form");await expect(entry).toBeVisible({timeout:20000});await entry.getByLabel("Owner / partner",{exact:true}).selectOption(owner.id);await entry.getByLabel("Transaction",{exact:true}).selectOption("CAPITAL_WITHDRAWAL");await entry.getByLabel("Cash / bank account",{exact:true}).selectOption(bank.id);await entry.getByLabel("Branch",{exact:true}).selectOption(branchId);await entry.getByLabel(`Repayment toward ${asset.name}`,{exact:true}).fill("5000");await entry.getByLabel("Amount",{exact:true}).fill("5000");await entry.locator('input[name="transactionDate"]').fill("2026-10-11");await entry.getByRole("button",{name:"Post owner transaction",exact:true}).click();await expect(entry.getByRole("status")).toHaveText("Owner transaction posted");
 const cash=await db.journalLine.aggregate({where:{companyId,ledgerAccountId:bankLedger.id,journalEntry:{status:{in:["POSTED","REVERSED"]}}},_sum:{debit:true,credit:true}});expect(cash._sum.debit?.sub(cash._sum.credit??0).toFixed(2)).toBe("0.00");expect((await db.asset.findUniqueOrThrow({where:{id:asset.id}})).purchaseValue.toFixed(2)).toBe("40000.00");expect((await db.ownerTransaction.findUniqueOrThrow({where:{id:investment.id}})).amount.toFixed(2)).toBe("30000.00");
 await page.getByRole("link",{name:"Asset funding",exact:true}).click();card=page.getByRole("region",{name:`Funding for ${asset.name}`,exact:true});await expect(card).toContainText("25,000.00");await expect(card).toContainText("15,000.00");const axe=await new AxeBuilder({page}).include(".employees-content").withTags(["wcag2a","wcag2aa"]).analyze();expect(axe.violations).toEqual([]);await page.evaluate(()=>document.documentElement.style.fontSize="200%");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await db.accountSettings.update({where:{companyId},data:{enabledModules:[]}});await page.goto(`/workspace/account/money/capital?branchId=${branchId}`);await page.locator("form.owner-entry-form").getByLabel("Transaction",{exact:true}).selectOption("CAPITAL_WITHDRAWAL");await expect(page.getByLabel(`Repayment toward ${asset.name}`,{exact:true})).toBeVisible();await page.goto(`/workspace/account/money/capital/funding?branchId=${branchId}`);await expect(page.getByText(/Enable Assets to record asset funding/)).toBeVisible();
});

test("A084 party ledger opening and export balances match web and native scoped results",async({page})=>{
 test.setTimeout(180000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{baseCurrency:"INR",displayDecimalPlaces:2}});
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Ledger audit year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
  const party=await db.customer.create({data:{companyId,branchId,name:"A084 ledger customer",isAccountCustomer:true}}),year=await db.financialYear.findFirstOrThrow({where:{companyId}}),ar=await db.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"ACCOUNTS_RECEIVABLE"}}),equity=await db.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"OPENING_BALANCE_EQUITY"}});
  const journal=await db.$transaction(tx=>postJournalInTx(tx,actor,{financialYearId:year.id,branchId,entryDate:"2026-10-01",sourceType:"OPENING_BALANCE",sourceId:randomUUID(),lines:[{ledgerAccountId:ar.id,debit:"30",credit:"0"},{ledgerAccountId:equity.id,debit:"0",credit:"30"}]}));
  await db.partyOpeningBalance.create({data:{companyId,branchId,partyId:party.id,partyType:"CUSTOMER",partyName:party.name,effectiveDate:new Date("2026-10-01"),amount:"30",journalEntryId:journal.id,createdById:userId}});
  const sale=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:party.id,issueDate:"2026-10-10",lines:[{lineType:"CUSTOM",itemName:"Ledger prior sale",quantity:"1",rate:"100",taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:sale.id});
  await createSettlementForActor(actor,{type:"CUSTOMER_RECEIPT",idempotencyKey:randomUUID(),branchId,partyId:party.id,paymentMode:"CASH",amount:"40",transactionDate:"2026-10-12",allocations:[{documentId:sale.id,amount:"40"}]});
  const query=`scope=all&from=2026-10-11&to=2026-10-12&customerId=${party.id}`;
  await signInSettings(page);await page.goto(`/workspace/account/reports/customer-ledger?${query}`);
  await expect(page.getByRole("heading",{name:"Customer Ledger",exact:true})).toBeVisible({timeout:20000});
  const rows=page.locator("tbody tr");await expect(rows).toHaveCount(2);await expect(rows.first()).toContainText("Opening balance");await expect(rows.first()).toContainText("130.00");await expect(rows.last()).toContainText("90.00");
  expect((await new AxeBuilder({page}).include(".employees-content").analyze()).violations).toEqual([]);
  for(const format of ["csv","xlsx","pdf"]){const response=await page.request.get(`/api/account/reports/customer-ledger/${format}?${query}`);expect(response.status()).toBe(200);let text="";if(format==="csv")text=await response.text();else if(format==="pdf")text=(await extractPdfText(await response.body())).text;else{const book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await response.body()).buffer);text=JSON.stringify(book.worksheets[0].getSheetValues())}expect(text).toContain("Opening balance");expect(text).toContain("130.00");expect(text).toContain("90.00")}
  const token=createSessionToken(),user=await db.user.findUniqueOrThrow({where:{id:userId}});await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:user.sessionVersion}});
  const native=await page.request.get(`/api/v1/mobile/account/reports/customer-ledger?${query}`,{headers:{authorization:`Bearer ${token}`}});expect(native.status()).toBe(200);const values=await native.json();expect(String(values.rows[0][5])).toContain("130.00");expect(String(values.rows.at(-1)[5])).toContain("90.00");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }finally{await page.goto("/workspace/account");await db.accountSettings.update({where:{companyId},data:{baseCurrency:original.baseCurrency,displayDecimalPlaces:original.displayDecimalPlaces}})}
});

test("A084 corrected sales keep dated profit and GST report history",async({page})=>{
 test.setTimeout(180000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["GST_ADVANCED"]}});
  await db.financialYear.create({data:{companyId,name:"Correction report year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
  const party=await db.customer.create({data:{companyId,branchId,name:"A084 correction history customer",isAccountCustomer:true}});
  const sale=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:party.id,issueDate:"2026-10-10",lines:[{lineType:"CUSTOM",itemName:"Dated correction service",quantity:"1",rate:"100",taxRate:"18"}]});
  await postCommercialDocumentForActor(actor,{documentId:sale.id});
  const credit=await reversePostedSaleForActor(actor,sale.id);
  await db.$transaction(async tx=>{
   await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
   await tx.commercialDocument.update({where:{id:sale.id},data:{status:"CANCELLED"}});
   await tx.commercialDocument.update({where:{id:credit.id},data:{issueDate:new Date("2026-10-14")}});
   await tx.journalEntry.update({where:{id:credit.journalEntryId!},data:{entryDate:new Date("2026-10-14")}});
   await tx.$executeRawUnsafe("SET LOCAL session_replication_role = origin");
  });
  await signInSettings(page);
  for(const to of ["2026-10-13","2026-10-14"]){
   const query=`scope=all&from=2026-10-10&to=${to}`;
   await page.goto(`/workspace/account/reports/customers?${query}`);
   const row=page.locator("tbody tr").filter({hasText:party.name});await expect(row).toHaveCount(1,{timeout:20000});await expect(row.locator("td").nth(2)).toHaveText(to.endsWith("13")?"₹100.00":"₹0.00");
   const profit=await page.request.get(`/api/account/reports/customers/pdf?${query}`);expect(profit.status()).toBe(200);expect((await extractPdfText(await profit.body())).text).toContain(party.name);
   await page.goto(`/workspace/account/reports/tax?${query}`);
   const gstRows=page.locator("tbody tr").filter({hasText:party.name});await expect(gstRows).toHaveCount(to.endsWith("13")?1:2,{timeout:20000});
  }
  expect((await new AxeBuilder({page}).include(".employees-content").analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules}})}
});

test("A084 profitability filters constrain web exports and native results",async({page})=>{
 test.setTimeout(180000);
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS","INVENTORY"]}});
  await db.financialYear.create({data:{companyId,name:"Profit filter year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
  const party=await db.customer.create({data:{companyId,branchId,name:"A084 filtered customer",isAccountCustomer:true}});
  const project=await db.project.create({data:{companyId,branchId,customerId:party.id,projectNumber:randomUUID(),name:"A084 filtered project",createdById:userId}});
  const products=await Promise.all(["A084 selected product","A084 other product"].map(name=>db.accountProduct.create({data:{companyId,name,trackInventory:false}})));
  const sale=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:party.id,projectId:project.id,issueDate:"2026-10-10",lines:products.map((product,index)=>({lineType:"PRODUCT",sourceId:product.id,quantity:"1",rate:index?"70":"30",taxRate:"0",unitName:index?"Kilogram":"Number",unitSymbol:index?"kg":"Nos"}))});await postCommercialDocumentForActor(actor,{documentId:sale.id});
  await signInSettings(page);await page.goto("/workspace/account/reports/customers?scope=all&from=2026-10-10&to=2026-10-10");
  await expect(page.locator("tbody tr").filter({hasText:party.name})).toContainText("Mixed units");
  await page.getByLabel("Customer",{exact:true}).selectOption(party.id,{timeout:20000});await page.getByLabel("Project",{exact:true}).selectOption(project.id,{timeout:20000});await page.getByLabel("Product",{exact:true}).selectOption(products[0].id,{timeout:20000});
  await expect(page.getByLabel("Vendor",{exact:true})).toHaveCount(0);await expect(page.getByLabel("Ledger",{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Run report",exact:true}).click();await expect(page).toHaveURL(new RegExp(`productId=${products[0].id}`));
  const row=page.locator("tbody tr").filter({hasText:party.name});await expect(row).toHaveCount(1);await expect(row.locator("td").nth(2)).toHaveText("₹30.00");await expect(row.locator("td").nth(1)).toHaveText("1.0000 Nos");
  const query=new URL(page.url()).searchParams.toString();for(const format of ["csv","xlsx","pdf"]){const response=await page.request.get(`/api/account/reports/customers/${format}?${query}`);expect(response.status()).toBe(200);let text="";if(format==="csv")text=await response.text();else if(format==="pdf")text=(await extractPdfText(await response.body())).text;else{const book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await response.body()).buffer);text=JSON.stringify(book.worksheets[0].getSheetValues())}expect(text).toContain("30.00");expect(text).toContain("1.0000 Nos");expect(text).not.toContain("70.00")}
  const token=createSessionToken(),user=await db.user.findUniqueOrThrow({where:{id:userId}});await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:user.sessionVersion}});
  const native=await page.request.get(`/api/v1/mobile/account/reports/customers?${query}`,{headers:{authorization:`Bearer ${token}`}});expect(native.status()).toBe(200);expect(String((await native.json()).rows[0][2])).toContain("30.00");
  expect((await new AxeBuilder({page}).include(".employees-content").analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:original.enabledModules}})}
});

test("A089 print visibility is limited to working outputs without losing saved fields",async({page})=>{
 test.setTimeout(120000);
 const legacy=await db.customFieldDefinition.create({data:{companyId,entityType:"PRODUCT",fieldKey:"legacy_print_scope",label:"Legacy product print field",dataType:"TEXT",validation:{showInPrint:true,retained:"metadata"}}});
 await db.customFieldValue.create({data:{companyId,definitionId:legacy.id,entityType:"PRODUCT",entityId:productId,value:"Retain product value"}});
 await signInSettings(page);await page.goto("/workspace/account/settings/custom-fields");
 const form=page.locator("form.account-form").first(),printing=form.getByLabel("Show in print",{exact:true});
 await printing.check();await form.getByLabel("Entity",{exact:true}).selectOption("PRODUCT");await expect(printing).toBeDisabled();await expect(printing).not.toBeChecked();await expect(form).toContainText("Printing custom fields is unavailable");
 await form.getByLabel("Entity",{exact:true}).selectOption("SALES_INVOICE");await expect(printing).toBeEnabled();await printing.check();
 const row=page.locator(".account-list > div").filter({hasText:"legacy_print_scope"});await row.getByText("Edit field",{exact:true}).click();await expect(row.getByLabel("Show in print",{exact:true})).toBeDisabled();await row.getByRole("button",{name:"Save field",exact:true}).click();await expect(row.getByText("Saved successfully",{exact:true})).toBeVisible();
 expect(await db.customFieldDefinition.findUniqueOrThrow({where:{id:legacy.id}})).toMatchObject({validation:{showInPrint:false,retained:"metadata"}});expect(await db.customFieldValue.findFirstOrThrow({where:{companyId,definitionId:legacy.id}})).toMatchObject({value:"Retain product value"});
 const token=createSessionToken(),user=await db.user.findUniqueOrThrow({where:{id:userId}});await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:user.sessionVersion}});
 const response=await page.request.post("/api/v1/mobile/account/settings/custom-fields",{headers:{authorization:`Bearer ${token}`},data:{id:legacy.id,entityType:"PRODUCT",fieldKey:"legacy_print_scope",label:legacy.label,dataType:"TEXT",showInPrint:true}});expect(response.status()).toBe(400);expect((await response.json()).error).toBe("CUSTOM_FIELD_PRINT_UNSUPPORTED");
 expect((await new AxeBuilder({page}).include(".account-main").analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("A065 owner correction preserves failed inputs and posts one balanced reversal",async({page})=>{
 test.setTimeout(180000);
 const year=await db.financialYear.create({data:{companyId,name:"Owner correction year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});expect(year.companyId).toBe(companyId);
 const ledger=async(accountClass:"ASSET"|"EQUITY"|"LIABILITY",normalBalance:"DEBIT"|"CREDIT")=>db.ledgerAccount.create({data:{companyId,code:randomUUID().slice(0,30),name:`Owner correction ${accountClass} ${normalBalance}`,accountClass,normalBalance}});
 const bankLedger=await ledger("ASSET","DEBIT"),capital=await ledger("EQUITY","CREDIT"),drawings=await ledger("EQUITY","DEBIT"),loan=await ledger("LIABILITY","CREDIT");
 const bank=await db.moneyAccount.create({data:{companyId,branchId,type:"BANK",name:"Owner correction bank",ledgerAccountId:bankLedger.id}}),owner=await db.ownerFinancialAccount.create({data:{companyId,name:"A065 correction owner",partyType:"OWNER",capitalLedgerId:capital.id,drawingsLedgerId:drawings.id,loanLedgerId:loan.id}}),actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
 const addition=await postOwnerTransactionForActor(actor,{ownerFinancialAccountId:owner.id,moneyAccountId:bank.id,branchId,type:"INVESTMENT",amount:"100",transactionDate:"2026-10-10",idempotencyKey:randomUUID()});
 await postOwnerTransactionForActor(actor,{ownerFinancialAccountId:owner.id,moneyAccountId:bank.id,branchId,type:"PROFIT_DISTRIBUTION",amount:"95",transactionDate:"2026-10-10",idempotencyKey:randomUUID()});
 await signInSettings(page);await page.goto(`/workspace/account/money/capital/${owner.id}?branchId=${branchId}`);
 await expect(page.locator("dl")).toContainText("100.00");await expect(page.locator("dl")).toContainText("95.00");
 const addRow=page.locator("article").filter({has:page.getByRole("heading",{name:"Capital addition",exact:true})});await addRow.getByText("Reverse this transaction",{exact:true}).click();await addRow.getByLabel("Correction date",{exact:true}).fill("2026-10-14");await addRow.getByLabel("Reason",{exact:true}).fill("Duplicate capital entry");await addRow.getByRole("button",{name:"Post reversal",exact:true}).click();await expect(addRow.getByRole("alert")).toContainText(/funds|balance/i);await expect(addRow.getByRole("alert")).toBeFocused();await expect(addRow.getByLabel("Reason",{exact:true})).toHaveValue("Duplicate capital entry");
 const drawRow=page.locator("article").filter({has:page.getByRole("heading",{name:"Profit distribution",exact:true})});await drawRow.getByText("Reverse this transaction",{exact:true}).click();await drawRow.getByLabel("Correction date",{exact:true}).fill("2026-10-14");await drawRow.getByLabel("Reason",{exact:true}).fill("Restore profit distribution");await drawRow.getByRole("button",{name:"Post reversal",exact:true}).click();await expect(drawRow).toContainText("REVERSED");
 await addRow.getByRole("button",{name:"Post reversal",exact:true}).click();await expect(addRow).toContainText("REVERSED");await expect(page.locator("dl dd")).toHaveText(["₹0.00","₹0.00","₹0.00"]);expect(await db.ownerTransaction.findUniqueOrThrow({where:{id:addition.id}})).toEqual(addition);expect(await db.journalEntry.count({where:{companyId,reversalOfId:addition.journalEntryId}})).toBe(1);
 const token=createSessionToken(),user=await db.user.findUniqueOrThrow({where:{id:userId}});await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:user.sessionVersion}});
 const nativeHistory=await page.request.get(`/api/v1/mobile/account/money/owners/${owner.id}?from=&to=&offset=0`,{headers:{authorization:`Bearer ${token}`}});expect(nativeHistory.status()).toBe(200);expect((await nativeHistory.json()).scope.branchId).toBe(branchId);
 const response=await page.request.post(`/api/v1/mobile/account/money/owners/${owner.id}/corrections`,{headers:{authorization:`Bearer ${token}`},data:{branchId,transactionId:addition.id,entryDate:"2026-10-14",reason:"Duplicate capital entry"}});expect(response.status()).toBe(200);expect(await db.journalEntry.count({where:{companyId,reversalOfId:addition.journalEntryId}})).toBe(1);
 await expect(page.getByRole("link",{name:"Back to Capital & Drawings",exact:true})).toHaveAttribute("href",`/workspace/account/money/capital?branchId=${branchId}`);
 await page.getByRole("button",{name:"Apply dates",exact:true}).click();await expect(page).toHaveURL(new RegExp(`branchId=${branchId}`));
 await db.ownerFinancialAccount.update({where:{id:owner.id},data:{name:"O".repeat(160)}});await page.reload();await expect(page.getByRole("heading",{name:"O".repeat(160),exact:true})).toBeVisible();
 expect((await new AxeBuilder({page}).include(".employees-content").analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("A058 item dialogs restore focus and reject invalid numeric saves without losing drafts",async({page})=>{
 const original=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),defaults=(original.transactionDefaults??{}) as import("@prisma/client").Prisma.JsonObject;
 await db.accountSettings.update({where:{companyId},data:{transactionDefaults:{...defaults,itemSettings:{itemUnits:true,itemCategory:true,itemType:"PRODUCTS"}}}});
 try{
  await signInSettings(page);await page.goto("/workspace/account/inventory/items/new");
  const name=page.getByRole("textbox",{name:"Item Name *",exact:true});await name.fill("Retained invalid item draft");
  const unitTrigger=page.locator(".add-item-unit-pill");await unitTrigger.click();
  const units=page.getByRole("dialog",{name:"Add Item Unit",exact:true});await expect(units).toBeVisible();
  await units.getByRole("button",{name:/Primary Unit/}).click();await units.getByRole("button",{name:"Add Unit",exact:true}).click();
  const newUnit=page.getByRole("dialog",{name:"Add Unit",exact:true});await expect(newUnit).toBeVisible();await newUnit.getByRole("textbox",{name:"Name",exact:true}).fill("Retained unit draft");await newUnit.getByRole("button",{name:"Save",exact:true}).focus();await page.keyboard.press("Tab");expect(await newUnit.evaluate(node=>node.contains(document.activeElement))).toBe(true);expect((await new AxeBuilder({page}).include('dialog[aria-label="Add Unit"]').withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");await expect(newUnit).not.toBeVisible();await expect(units.getByRole("button",{name:"Add Unit",exact:true})).toBeFocused();
  await page.keyboard.press("Escape");await expect(units).not.toBeVisible();await expect(unitTrigger).toBeFocused();
  const categoryTrigger=page.getByRole("button",{name:/Item Category.*Select Category/});await categoryTrigger.click();
  const category=page.getByRole("dialog",{name:"Select Category",exact:true});await category.getByRole("button",{name:/Add New Category/}).click();
  const newCategory=page.getByRole("dialog",{name:"Add New Category",exact:true});await newCategory.getByRole("textbox",{name:"Category Name",exact:true}).fill("Retained category draft");await page.keyboard.press("Escape");await expect(newCategory).not.toBeVisible();await expect(category.getByRole("button",{name:/Add New Category/})).toBeFocused();await page.keyboard.press("Escape");await expect(categoryTrigger).toBeFocused();
  const price=page.getByPlaceholder("Sale Price",{exact:true});await price.fill("-1");await page.getByRole("button",{name:"Save",exact:true}).click();await expect(price).toBeFocused();expect(await price.evaluate((node:HTMLInputElement)=>node.validity.rangeUnderflow)).toBe(true);await expect(name).toHaveValue("Retained invalid item draft");expect(await db.accountProduct.count({where:{companyId,name:"Retained invalid item draft"}})).toBe(0);
 }finally{await db.accountSettings.update({where:{companyId},data:{transactionDefaults:original.transactionDefaults??{}}})}
});


test("A052 category overview uses posted totals and items search pagination with scoped entry",async({page})=>{
 test.setTimeout(180000);
 const suffix=randomUUID().slice(0,8),categoryId=randomUUID(),cashLedger=randomUUID(),expenseLedger=randomUUID(),moneyId=randomUUID();let expenseId:string|undefined;
 const itemPrefix=`Overview ${suffix}`;
 await db.ledgerAccount.createMany({data:[{id:cashLedger,companyId,code:`OC-${suffix}`,name:`Overview cash ${suffix}`,accountClass:"ASSET",normalBalance:"DEBIT"},{id:expenseLedger,companyId,code:`OE-${suffix}`,name:`Overview expense ${suffix}`,accountClass:"EXPENSE",normalBalance:"DEBIT"}]});
 await db.expenseCategory.create({data:{id:categoryId,companyId,name:`Overview category ${suffix}`,scope:"EXPENSE",defaultLedgerAccountId:expenseLedger}});
 await db.moneyAccount.create({data:{id:moneyId,companyId,branchId,name:`Overview cash ${suffix}`,type:"CASH",ledgerAccountId:cashLedger}});
 if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Overview year",startDate:new Date("2026-04-01"),endDate:new Date("2027-03-31")}});
 try{
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
  const created=await createExpenseForActor(actor,{type:"OFFICE_EXPENSE",branchId,categoryId,moneyAccountId:moneyId,transactionDate:"2026-10-13",taxableAmount:"12.34",billedItems:[{name:`Report bolts ${suffix}`,quantity:"2",rate:"6.17"}],recordAsPaid:true,requestKey:randomUUID()});expenseId=created.id;
  await db.expenseItem.createMany({data:Array.from({length:26},(_,i)=>({companyId,name:`${itemPrefix} ${String(i).padStart(2,"0")}`,normalizedName:`${itemPrefix.toLowerCase()} ${String(i).padStart(2,"0")}`,creationRequestKey:randomUUID(),creationRequestHash:"0".repeat(64)}))});
  await signInSettings(page);await page.goto(`/workspace/account/expenses?branchId=${branchId}`);
  const overview=page.getByRole("region",{name:"Expense overview",exact:true});await expect(overview.getByRole("link",{name:"Categories",exact:true})).toHaveAttribute("aria-current","page");await expect(overview.locator("article").filter({hasText:`Overview category ${suffix}`})).toContainText("₹12.34");
  await overview.getByRole("link",{name:"Items",exact:true}).click();await page.getByRole("textbox",{name:"Search items",exact:true}).fill(itemPrefix);await page.getByRole("button",{name:"Search overview",exact:true}).click();await expect(overview.locator("article")).toHaveCount(25);await overview.getByRole("link",{name:"Next items",exact:true}).click();await expect(overview.locator("article")).toHaveCount(1);await page.reload();await expect(overview.getByRole("link",{name:"Items",exact:true})).toHaveAttribute("aria-current","page");await expect(overview).toContainText(`${itemPrefix} 25`);
  await page.getByRole("textbox",{name:"Search items",exact:true}).fill("not-existing-overview-item");await page.getByRole("button",{name:"Search overview",exact:true}).click();await expect(overview.getByRole("status")).toContainText("No expense items found");
  await expect(overview.getByRole("link",{name:"＋ Add Expenses",exact:true})).toHaveAttribute("href",`/workspace/account/expenses/new?branchId=${branchId}`);
  await overview.getByRole("link",{name:"＋ Add Expenses",exact:true}).click();await expect(page.getByRole("heading",{name:"New Expense / Income",exact:true})).toBeVisible();
  await page.goto(`/workspace/account/expenses?branchId=${branchId}`);await overview.getByRole("link",{name:"＋ Add Expense / Income Category",exact:true}).click();await expect(page.getByRole("textbox",{name:"Category name",exact:true})).toBeVisible();
  const journalsBefore=await db.journalEntry.count({where:{companyId}});
  for(const report of ["expense-transactions","expense-category","expense-items"]){
   await page.goto(`/workspace/account/reports/${report}?branchId=${branchId}&from=2026-10-13&to=2026-10-13`);
   const results=page.getByRole("region",{name:"Report results",exact:true});await expect(results).toContainText("12.34");
   if(report==="expense-items")await expect(results).toContainText(`Report bolts ${suffix}`);
   if(report==="expense-category")await expect(results).toContainText(`Overview category ${suffix}`);
   const csv=await page.request.get((await page.getByRole("link",{name:"CSV",exact:true}).getAttribute("href"))!);expect(csv.status()).toBe(200);expect(await csv.text()).toContain("12.34");
   expect((await new AxeBuilder({page}).include(".employees-content").analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.goto(`/workspace/account/reports/expense-transactions?branchId=${branchId}&from=2026-10-13&to=2026-10-13`);
  await page.getByRole("region",{name:"Report results",exact:true}).locator(`a[href="/workspace/account/expenses/${expenseId}"]:visible`).click();await expect(page).toHaveURL(new RegExp(`/expenses/${expenseId}`),{timeout:20000});expect(await db.journalEntry.count({where:{companyId}})).toBe(journalsBefore);
  await page.goto(`/workspace/account/expenses?branchId=${branchId}`);expect((await new AxeBuilder({page}).include(".employees-content").withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{
  await db.$transaction(async tx=>{await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;if(expenseId){const journals=await tx.journalEntry.findMany({where:{companyId,sourceId:expenseId},select:{id:true}}),ids=journals.map(x=>x.id);await tx.expenseTransaction.deleteMany({where:{companyId,id:expenseId}});await tx.accountingAuditEvent.deleteMany({where:{companyId,entityId:{in:ids}}});await tx.journalLine.deleteMany({where:{companyId,journalEntryId:{in:ids}}});await tx.journalEntry.deleteMany({where:{companyId,id:{in:ids}}});await tx.accountOperationalAudit.deleteMany({where:{companyId,entityId:expenseId}})}await tx.expenseItem.deleteMany({where:{companyId,name:{startsWith:itemPrefix}}});await tx.expenseCategory.deleteMany({where:{companyId,id:categoryId}});await tx.moneyAccount.deleteMany({where:{companyId,id:moneyId}});await tx.ledgerAccount.deleteMany({where:{companyId,id:{in:[cashLedger,expenseLedger]}}})})
 }
});

test("A064 name-only bank can add full optional details later", async ({page}) => {
  test.setTimeout(120000);
  await signInSettings(page);
  await page.goto(`/workspace/account/money/accounts?branchId=${branchId}`);
  const form=page.locator("form").filter({has:page.getByRole("button",{name:"Create account and asset ledger",exact:true})});
  const name=`Name-only bank ${randomUUID().slice(0,8)}`;
  await form.getByLabel("Account type",{exact:true}).selectOption("BANK");
  await form.getByLabel("Account display name",{exact:true}).fill(name);
  await form.getByLabel("Branch",{exact:true}).selectOption(branchId);
  await form.getByRole("button",{name:"Create account and asset ledger",exact:true}).click();
  await expect(form.getByRole("status")).toContainText("Money account created",{timeout:20000});
  const bank=await db.moneyAccount.findFirstOrThrow({where:{companyId,name}});
  expect(bank.upiId).toBeNull();expect(bank.accountNumberMasked??"").toBe("");
  const journals=await db.journalEntry.count({where:{companyId}});
  await page.goto(`/workspace/account/money/accounts/${bank.id}?branchId=${branchId}`);
  await expect(page.getByText("No posted entries match these dates.",{exact:true})).toBeVisible();
  const edit=page.locator("form").filter({has:page.getByRole("button",{name:"Save account details",exact:true})});
  await edit.getByLabel("Bank name",{exact:true}).fill("Canara Bank");
  await edit.getByLabel("Account holder name",{exact:true}).fill("Business holder");
  await edit.getByLabel("Bank branch name",{exact:true}).fill("Main branch");
  await edit.getByLabel("Masked account number",{exact:true}).fill("****4321");
  await edit.getByLabel("IFSC",{exact:true}).fill("CNRB0001234");
  await edit.getByRole("button",{name:"Save account details",exact:true}).click();
  await expect(edit.getByRole("status")).toContainText("Account details saved",{timeout:20000});
  expect(await db.moneyAccount.findUniqueOrThrow({where:{id:bank.id}})).toMatchObject({bankName:"Canara Bank",accountHolderName:"Business holder",bankBranchName:"Main branch",accountNumberMasked:"****4321",ifsc:"CNRB0001234",upiId:null});
  expect(await db.journalEntry.count({where:{companyId}})).toBe(journals);
  const nativeToken=createSessionToken(),nativeUser=await db.user.findUniqueOrThrow({where:{id:userId}});
  await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(nativeToken),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:nativeUser.sessionVersion}});
  const headers={authorization:`Bearer ${nativeToken}`};
  const history=await page.request.get(`/api/v1/mobile/account/money/accounts/${bank.id}/history?branchId=${branchId}`,{headers});
  expect(history.status()).toBe(200);expect(history.headers()["cache-control"]).toBe("no-store");
  expect(await history.json()).toMatchObject({account:{id:bank.id,bankName:"Canara Bank",accountHolderName:"Business holder"},closing:"0.00",rows:[]});
  expect((await page.request.get(`/api/v1/mobile/account/money/accounts/${randomUUID()}/history?branchId=${branchId}`,{headers})).status()).toBe(403);
  expect((await page.request.get(`/api/v1/mobile/account/money/accounts/${bank.id}/history?branchId=${branchId}`)).status()).toBe(401);
  await page.getByRole("link",{name:"Back to parent page",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/money/bank-accounts\\?branchId=${branchId}$`));
  await expect(page.getByText(name,{exact:true}).first()).toBeVisible();
});


test("A090 inventory prices retain exact cents in selected company currency",async({page})=>{
 test.setTimeout(120000);
 const before=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 const item=await db.accountProduct.findUniqueOrThrow({where:{id:productId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{baseCurrency:"USD",displayDecimalPlaces:3}});
  await db.accountProduct.update({where:{id:productId},data:{salePrice:"90071992547409.91",costPrice:"12.35"}});
  await signInSettings(page);await page.goto("/workspace/account/inventory");
  const card=page.getByRole("article").filter({has:page.getByRole("heading",{name:item.name,exact:true})});
  const preferences=resolveDisplayPreferences({baseCurrency:"USD",displayDecimalPlaces:3});
  await expect(card.getByText(formatMoney("90071992547409.91",preferences),{exact:true})).toBeVisible({timeout:20000});
  await expect(card.getByText(formatMoney("12.35",preferences),{exact:true})).toBeVisible();
  await expect(card).not.toContainText("₹");
 }finally{
  await db.accountSettings.update({where:{companyId},data:{baseCurrency:before.baseCurrency,displayDecimalPlaces:before.displayDecimalPlaces}});
  await db.accountProduct.update({where:{id:productId},data:{salePrice:item.salePrice,costPrice:item.costPrice}});
 }
});

test("A085 report hub searches groups and persists scoped favourites across web and mobile API",async({page,request})=>{
 test.setTimeout(180000);
 const previous=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["ASSETS","PROJECTS","PROJECT_COSTING"]}});
  const login=await request.post("/api/v1/mobile/auth/login",{data:{identifier:email,password,deviceId:randomUUID(),deviceName:"Report favourites"}});expect(login.status()).toBe(200);
  const headers={authorization:`Bearer ${(await login.json()).accessToken}`};
  const saved=await request.post("/api/v1/mobile/account/reports/favourites",{headers,data:{reportKey:"tax",favourite:true}});expect(saved.status()).toBe(200);expect((await saved.json()).favourites).toContain("tax");
  const invalid=await request.post("/api/v1/mobile/account/reports/favourites",{headers,data:{reportKey:"tax",favourite:true,companyId:otherCompanyId}});expect(invalid.status()).toBe(400);
  settingsCookies=[];await signInSettings(page);
  await page.goto(`/workspace/account/reports?branchId=${branchId}&from=2026-04-01&to=2026-10-16`);
  await expect(page.getByRole("region",{name:"Favourite reports",exact:true}).getByRole("link",{name:"GST / Tax Report",exact:true})).toBeVisible();
  await page.getByLabel("Search reports",{exact:true}).fill("withdrawal");
  const group=page.getByRole("region",{name:"Owners & Partners reports",exact:true});
  await expect(group.getByRole("link",{name:"Profit Withdrawal",exact:true})).toHaveAttribute("href",new RegExp(`branchId=${branchId}.*from=2026-04-01.*to=2026-10-16`));
  await group.getByRole("button",{name:"Add Profit Withdrawal to favourites",exact:true}).click();
  await expect(group.getByRole("button",{name:"Remove Profit Withdrawal from favourites",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.reload();await expect(page.getByRole("region",{name:"Favourite reports",exact:true}).getByRole("link",{name:"Profit Withdrawal",exact:true})).toBeVisible();
  await page.getByLabel("Search reports",{exact:true}).fill("no-such-report");await expect(page.getByText("No reports match your search.",{exact:true})).toBeVisible();await page.getByLabel("Search reports",{exact:true}).fill("");
  const sourceUser=await db.user.findUniqueOrThrow({where:{id:userId}}),token=createSessionToken();await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:sourceUser.sessionVersion}});const materialHeaders={authorization:`Bearer ${token}`},journalCount=await db.journalEntry.count({where:{companyId}});
  for(const [key,title] of [["material-consumption","Material Consumption"],["project-transfer","Project Transfer"]]){await expect(page.getByRole("link",{name:title,exact:true})).toBeVisible();const result=await page.request.get(`/api/v1/mobile/account/reports/${key}?branchId=${branchId}`,{headers:materialHeaders});expect(result.status()).toBe(200);expect(await result.json()).toMatchObject({title,rows:[]});await page.goto(`/workspace/account/reports/${key}?branchId=${branchId}`);await expect(page.getByRole("heading",{name:title,exact:true})).toBeVisible();await page.goto(`/workspace/account/reports?branchId=${branchId}&from=2026-04-01&to=2026-10-16`);}
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["ASSETS"]}});await page.reload();for(const key of ["material-consumption","project-transfer"]){expect((await page.request.get(`/api/v1/mobile/account/reports/${key}?branchId=${branchId}`,{headers:materialHeaders})).status()).toBe(403)}await expect(page.getByRole("link",{name:"Material Consumption",exact:true})).toHaveCount(0);await expect(page.getByRole("link",{name:"Project Transfer",exact:true})).toHaveCount(0);expect(await db.journalEntry.count({where:{companyId}})).toBe(journalCount);await db.accountSettings.update({where:{companyId},data:{enabledModules:["ASSETS","PROJECTS","PROJECT_COSTING"]}});await page.reload();
  expect((await new AxeBuilder({page}).include('section[aria-label="Report catalogue"]').analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await db.user.update({where:{id:userId},data:{accountRole:"PROJECT_MANAGER"}});
  await page.goto(`/workspace/account/reports?branchId=${branchId}`);await expect(page.getByRole("link",{name:"Project Report",exact:true})).toBeVisible();await expect(page.getByRole("link",{name:"Profit & Loss",exact:true})).toHaveCount(0);
 }finally{await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});await db.accountReportFavourite.deleteMany({where:{companyId,userId}});await db.accountSettings.update({where:{companyId},data:{enabledModules:previous.enabledModules}})}
});


test("A084 report periods apply to visible results and exports and ignored filters are rejected",async({page,request})=>{
 test.setTimeout(120000);
 const login=await request.post("/api/v1/mobile/auth/login",{data:{identifier:email,password,deviceId:randomUUID(),deviceName:"Report filters"}});expect(login.status()).toBe(200);const headers={authorization:`Bearer ${(await login.json()).accessToken}`};
 const invalid=await request.get(`/api/v1/mobile/account/reports/profit-loss?customerId=${customerId}`,{headers});expect(invalid.status()).toBe(400);
 settingsCookies=[];await signInSettings(page);await page.goto(`/workspace/account/reports/profit-withdrawal?branchId=${branchId}`);
 await expect(page.getByLabel("Customer",{exact:true})).toHaveCount(0);await expect(page.getByLabel("Vendor",{exact:true})).toHaveCount(0);await expect(page.getByLabel("Ledger",{exact:true})).toHaveCount(0);await expect(page.getByLabel("Owner / Partner",{exact:true})).toBeVisible();
 const range=reportPeriodBounds("THIS_MONTH",reportCalendarDate());await page.getByLabel("Report period",{exact:true}).selectOption("THIS_MONTH");
 await expect(page.getByLabel("From",{exact:true})).toHaveValue(range.from);await expect(page.getByLabel("To / As of",{exact:true})).toHaveValue(range.to);
 await page.getByRole("button",{name:"Run report",exact:true}).click();await expect(page).toHaveURL(new RegExp(`from=${range.from}.*to=${range.to}`),{timeout:20000});
 const csv=page.getByRole("link",{name:"CSV",exact:true});await expect(csv).toHaveAttribute("href",new RegExp(`from=${range.from}.*to=${range.to}`));const exported=await page.request.get((await csv.getAttribute("href"))!);expect(exported.status()).toBe(200);
 await expect(page.getByRole("region",{name:"Report results",exact:true})).toBeVisible();
});

test("A084 sale report summary,source navigation and empty purchase state use posted transactions",async({page})=>{
 test.setTimeout(120000);
 if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Report verification year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
 for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:`REPORT ${row.name}`,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
 const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
 const sale=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",branchId,partyId:customerId,issueDate:"2026-10-10",idempotencyKey:randomUUID(),lines:[{lineType:"CUSTOM",itemName:"Report browser item",quantity:"1",rate:"100",taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:sale.id});
 const journals=await db.journalEntry.count({where:{companyId}});
 await signInSettings(page);await page.goto(`/workspace/account/reports/sale-report?branchId=${branchId}&from=2026-10-10&to=2026-10-10`);
 const summary=page.getByRole("region",{name:"Report summary",exact:true});await expect(summary.getByText("No. of Transactions",{exact:true}).locator("..")).toContainText("1");await expect(summary.getByText("Total Sale",{exact:true}).locator("..")).toContainText("100.00");await expect(summary.getByText("Balance Due",{exact:true}).locator("..")).toContainText("100.00");
 const csv=await page.request.get((await page.getByRole("link",{name:"CSV",exact:true}).getAttribute("href"))!);expect(csv.status()).toBe(200);const csvText=await csv.text();expect(csvText).toContain("No. of Transactions");expect(csvText).toContain("Total Sale");
 expect((await new AxeBuilder({page}).include('.employees-content').analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const source=page.getByRole("region",{name:"Report results",exact:true}).locator(`a[href="/workspace/account/sales/${sale.id}"]:visible`);await source.click();await expect(page).toHaveURL(new RegExp(`/sales/${sale.id}`),{timeout:20000});
 await page.goto(`/workspace/account/reports/purchase-report?branchId=${branchId}&from=2026-10-10&to=2026-10-10`);await expect(page.getByRole("region",{name:"No report transactions",exact:true})).toContainText("No transactions for this period");expect(await db.journalEntry.count({where:{companyId}})).toBe(journals);
 expect((await new AxeBuilder({page}).include('.employees-content').analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("A057 saved sale prices require explicit consent and leave invoice journals unchanged",async({page,request})=>{
 test.setTimeout(180000);
 const previous=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),name=`Price consent ${randomUUID().slice(0,8)}`;
 await db.accountSettings.update({where:{companyId},data:{itemSettings:{...previous.itemSettings as object,updateSalePrice:true},enabledModules:["SALES","INVENTORY"]}});
 if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Price consent year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
 for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:`PRICE ${row.name}`,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
 const product=await db.accountProduct.create({data:{companyId,name,salePrice:"100",costPrice:"50",taxRate:"0"}}),actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
 const source=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",branchId,partyId:customerId,issueDate:"2026-10-10",idempotencyKey:randomUUID(),lines:[{lineType:"PRODUCT",sourceId:product.id,quantity:"1",rate:"120",taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:source.id});
 try{
  const count=await db.commercialDocument.count({where:{companyId}});await signInSettings(page);
  await page.goto(`/workspace/account/transactions/new?type=SALES_INVOICE&duplicateId=${source.id}`);await expect(page.getByText(name,{exact:true})).toBeVisible();await page.getByRole("button",{name:"Save & New",exact:true}).click();
  const prompt=page.getByRole("dialog",{name:"Update saved retail prices",exact:true});await expect(prompt.getByRole("button",{name:`Update retail price for ${name}`,exact:true})).toBeVisible({timeout:20000});expect((await db.accountProduct.findUniqueOrThrow({where:{id:product.id}})).salePrice?.toString()).toBe("100");
  expect((await new AxeBuilder({page}).include('dialog[open]').analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await prompt.getByRole("button",{name:"Keep remaining saved prices",exact:true}).click();await expect(prompt).not.toBeVisible();expect((await db.accountProduct.findUniqueOrThrow({where:{id:product.id}})).salePrice?.toString()).toBe("100");expect(await db.commercialDocument.count({where:{companyId}})).toBe(count+1);
  await page.goto(`/workspace/account/transactions/new?type=SALES_INVOICE&duplicateId=${source.id}`);await page.getByRole("button",{name:"Save",exact:true}).click();await expect(prompt.getByRole("button",{name:`Update retail price for ${name}`,exact:true})).toBeVisible({timeout:20000});
  const journals=await db.journalEntry.count({where:{companyId}});await prompt.getByRole("button",{name:`Update retail price for ${name}`,exact:true}).click();await expect.poll(async()=>(await db.accountProduct.findUniqueOrThrow({where:{id:product.id}})).salePrice?.toString()).toBe("120");await expect(prompt).not.toBeVisible();expect(await db.journalEntry.count({where:{companyId}})).toBe(journals);expect(await db.commercialDocument.count({where:{companyId}})).toBe(count+2);expect(await db.accountOperationalAudit.count({where:{companyId,eventType:"SALE_MASTER_PRICE_CONFIRMED",entityId:product.id}})).toBe(1);
  const login=await request.post("/api/v1/mobile/auth/login",{data:{identifier:email,password,deviceId:randomUUID(),deviceName:"Price consent API"}});expect(login.status()).toBe(200);const headers={authorization:`Bearer ${(await login.json()).accessToken}`};
  expect((await request.get(`/api/v1/mobile/account/transactions/${source.id}/sale-price`,{headers})).status()).toBe(200);
  const apiSale=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",branchId,partyId:customerId,issueDate:"2026-10-10",idempotencyKey:randomUUID(),lines:[{lineType:"PRODUCT",sourceId:product.id,quantity:"1",rate:"140",taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:apiSale.id});
  const choices=await request.get(`/api/v1/mobile/account/transactions/${apiSale.id}/sale-price`,{headers});expect(choices.status()).toBe(200);const choice=(await choices.json())[0];let body={lineId:choice.lineId,expectedUpdatedAt:choice.expectedUpdatedAt,requestKey:randomUUID(),confirmed:true};expect(choice).toMatchObject({oldPrice:"120",newPrice:"140"});await db.accountProduct.update({where:{id:product.id},data:{salePrice:"125",updatedAt:new Date(Date.now()+1000)}});expect((await request.post(`/api/v1/mobile/account/transactions/${apiSale.id}/sale-price`,{headers,data:body})).status()).toBe(409);const refreshed=(await (await request.get(`/api/v1/mobile/account/transactions/${apiSale.id}/sale-price`,{headers})).json())[0];body={...body,expectedUpdatedAt:refreshed.expectedUpdatedAt,requestKey:randomUUID()};const apiJournals=await db.journalEntry.count({where:{companyId}});
  expect((await request.post(`/api/v1/mobile/account/transactions/${apiSale.id}/sale-price`,{headers,data:body})).status()).toBe(200);expect((await db.accountProduct.findUniqueOrThrow({where:{id:product.id}})).salePrice?.toString()).toBe("140");expect((await request.post(`/api/v1/mobile/account/transactions/${apiSale.id}/sale-price`,{headers,data:body})).status()).toBe(200);expect(await db.journalEntry.count({where:{companyId}})).toBe(apiJournals);

  await db.user.update({where:{id:userId},data:{accountRole:"DATA_ENTRY"}});expect((await request.get(`/api/v1/mobile/account/transactions/${source.id}/sale-price`,{headers})).status()).toBe(403);expect((await request.post(`/api/v1/mobile/account/transactions/${source.id}/sale-price`,{headers,data:{confirmed:true,lineId:randomUUID(),expectedUpdatedAt:new Date().toISOString(),requestKey:randomUUID()}})).status()).toBe(403);
 }finally{settingsCookies=[];await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});await db.accountSettings.update({where:{companyId},data:{itemSettings:previous.itemSettings??{},enabledModules:previous.enabledModules}});}
});

test("A058 item validation retains fields and unit dialog traps keyboard focus without nested landmarks",async({page})=>{
 test.setTimeout(120000);const previous=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),name=`Validation ${randomUUID()}`;
 await db.accountSettings.update({where:{companyId},data:{itemSettings:{...previous.itemSettings as object,taxOnMrp:true,itemUnits:true}}});
 try{
  await signInSettings(page);await page.goto("/workspace/account/inventory/items/new");await page.getByLabel("Item Name *",{exact:true}).fill(name);const sale=page.getByPlaceholder("Sale Price",{exact:true}),mrp=page.getByLabel("MRP (tax included)",{exact:true});
  await sale.fill("-1");await page.getByRole("button",{name:"Save",exact:true}).click();await expect(sale).toBeFocused();await expect(sale).toHaveValue("-1");expect(await db.accountProduct.count({where:{companyId,name}})).toBe(0);
  await sale.fill("1");await mrp.fill("1.12345");await page.getByRole("button",{name:"Save",exact:true}).click();await expect(mrp).toBeFocused();await expect(mrp).toHaveValue("1.12345");expect(await db.accountProduct.count({where:{companyId,name}})).toBe(0);await mrp.fill("1.18");
  const unit=page.getByRole("button",{name:"Select Unit",exact:true});await unit.click();const dialog=page.getByRole("dialog",{name:"Add Item Unit",exact:true});await expect(dialog).toBeVisible();for(let i=0;i<8;i++){await page.keyboard.press("Tab");expect(await page.evaluate(()=>Boolean(document.activeElement?.closest('dialog[open]')))).toBe(true);}await page.keyboard.press("Escape");await expect(dialog).not.toBeVisible();await expect(unit).toBeFocused();await expect(page.getByLabel("Item Name *",{exact:true})).toHaveValue(name);expect(await page.locator("main main").count()).toBe(0);
  expect((await new AxeBuilder({page}).include('.add-item-page').analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await db.accountSettings.update({where:{companyId},data:{itemSettings:previous.itemSettings??{}}});}
});

test("A057 Customer Price is separate from Retail and respects active dates",async({page})=>{
 test.setTimeout(120000);
 const previous=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),name=`Customer price ${randomUUID().slice(0,8)}`;
 await db.accountSettings.update({where:{companyId},data:{itemSettings:{...previous.itemSettings as object,partyWiseRate:true,itemWiseDiscount:true,wholesalePrice:true},enabledModules:["SALES","INVENTORY"],defaultTaxMode:"EXCLUSIVE"}});
 const product=await db.accountProduct.create({data:{companyId,name,salePrice:"100",taxRate:"0",pricing:{enteredSalePrice:"100",saleTaxMode:"EXCLUSIVE",discountType:"FIXED",discountValue:"10",normalizedDiscountValue:"10",normalizedWholesalePrice:"90",wholesalePrice:"90"}}});
 const date=new Date().toISOString().slice(0,10),customer=await db.customer.findUniqueOrThrow({where:{id:customerId}});
 await db.productPrice.create({data:{companyId,productId:product.id,customerId,priceType:"CUSTOMER",rate:"80",effectiveFrom:new Date(date),effectiveTo:new Date(date)}});
 await db.productPrice.create({data:{companyId,productId:product.id,priceType:"WHOLESALE",rate:"70",effectiveFrom:new Date(date),effectiveTo:new Date(date)}});
 try{
  await signInSettings(page);await page.goto("/workspace/account/transactions/new?type=SALES_INVOICE");
  await page.getByPlaceholder("Search customer name or phone").fill(customer.name);await page.getByRole("button",{name:new RegExp(customer.name)}).click();
  await page.getByRole("button",{name:/Add Items/}).click();await page.getByText(name,{exact:true}).click();
  const type=page.getByRole("combobox",{name:"Price type",exact:true}),rate=page.getByRole("spinbutton",{name:"Rate (Price/Unit)",exact:true});
  await expect(type).toHaveValue("RETAIL");await expect(rate).toHaveValue("100");
  await type.selectOption("WHOLESALE");await expect(rate).toHaveValue("70");
  await type.selectOption("CUSTOMER");await expect(rate).toHaveValue("80");
  await page.getByRole("spinbutton",{name:"Quantity",exact:true}).fill("3");
  const picker=page.locator("section").filter({has:page.getByRole("heading",{name:"Add Items to Sale",exact:true})});await picker.getByRole("button",{name:"Save",exact:true}).click();
  const billed=page.locator("article").filter({has:page.getByText(name,{exact:true})});await expect(billed).toContainText("3 Nos");await expect(billed).toContainText("80.00");await expect(billed).toContainText("30.00");await expect(billed).toContainText("210.00");
  expect((await db.accountProduct.findUniqueOrThrow({where:{id:product.id}})).salePrice?.toString()).toBe("100");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 } finally {await db.accountSettings.update({where:{companyId},data:{itemSettings:previous.itemSettings??{},enabledModules:previous.enabledModules,defaultTaxMode:previous.defaultTaxMode}})}
});

test("A058 private item photos persist and upload recovery never recreates an item",async({page})=>{
 test.setTimeout(150000);
 const previous=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),name=`Item photo ${randomUUID().slice(0,8)}`,recoveryName=`Photo recovery ${randomUUID().slice(0,8)}`;
 await db.accountSettings.update({where:{companyId},data:{itemSettings:{...previous.itemSettings as object,enabled:true},enabledModules:["INVENTORY"]}});
 const bytes=await (await import("sharp")).default({create:{width:60,height:40,channels:3,background:"red"}}).png().toBuffer();
 try{
  await signInSettings(page);await page.goto("/workspace/account/inventory/items/new");await page.getByRole("textbox",{name:"Item Name *",exact:true}).fill(name);
  const picker=page.getByLabel("Item photo",{exact:true});await picker.setInputFiles({name:"bad.txt",mimeType:"text/plain",buffer:Buffer.from("plain")});await expect(page.getByText("Choose an image up to 5 MB.",{exact:true})).toBeVisible();expect(await db.accountProduct.count({where:{companyId,name}})).toBe(0);
  await picker.setInputFiles({name:"red.png",mimeType:"image/png",buffer:bytes});await expect(page.getByText("Photo selected: red.png",{exact:false})).toBeVisible();await page.getByRole("button",{name:"Remove photo",exact:true}).click();await expect(page.getByRole("button",{name:"Remove photo",exact:true})).toHaveCount(0);
  await picker.setInputFiles({name:"red.png",mimeType:"image/png",buffer:bytes});await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page).toHaveURL(/\/account\/inventory$/,{timeout:20000});
  const row=await db.accountProduct.findFirstOrThrow({where:{companyId,name}});expect(await db.accountProduct.count({where:{companyId,name}})).toBe(1);expect(row.photoObjectKey).toBeTruthy();
  const image=page.getByRole("img",{name:`${name} photo`,exact:true});await expect(image).toBeVisible();await expect.poll(()=>image.evaluate(node=>(node as HTMLImageElement).naturalWidth)).toBe(60);
  const response=await page.request.get(`/api/account/item-photos/products/${row.id}`);expect(response.status()).toBe(200);expect(response.headers()["content-type"]).toBe("image/webp");expect(response.headers()["cache-control"]).toBe("private, no-store");expect((await page.request.get(`/api/account/item-photos/products/${randomUUID()}`)).status()).toBe(404);
  await page.goto("/workspace/account/inventory/items/new");await page.getByRole("textbox",{name:"Item Name *",exact:true}).fill(recoveryName);await page.getByLabel("Item photo",{exact:true}).setInputFiles({name:"corrupt.jpg",mimeType:"image/jpeg",buffer:Buffer.from("not an image")});await page.getByRole("button",{name:"Save",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Item saved",exact:true})).toBeVisible({timeout:20000});expect(await db.accountProduct.count({where:{companyId,name:recoveryName}})).toBe(1);const target=await db.accountProduct.findFirstOrThrow({where:{companyId,name:recoveryName}});expect(target.photoObjectKey).toBeNull();
  await page.getByLabel("Replacement item photo",{exact:true}).setInputFiles({name:"replacement.png",mimeType:"image/png",buffer:bytes});expect((await new AxeBuilder({page}).include('section[aria-label="Item photo recovery"]').withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);await page.getByRole("button",{name:"Retry photo upload",exact:true}).click();await expect(page).toHaveURL(/\/account\/inventory$/,{timeout:20000});expect(await db.accountProduct.count({where:{companyId,name:recoveryName}})).toBe(1);expect((await db.accountProduct.findUniqueOrThrow({where:{id:target.id}})).photoObjectKey).toBeTruthy();expect(await db.accountOperationalAudit.count({where:{companyId,eventType:"ITEM_PHOTO_SAVED",entityId:target.id}})).toBe(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 }finally{const photos=await db.accountProduct.findMany({where:{companyId,name:{in:[name,recoveryName]}},select:{photoObjectKey:true}});for(const row of photos)if(row.photoObjectKey)await privateStorage().delete(row.photoObjectKey).catch(()=>{});await db.accountSettings.update({where:{companyId},data:{itemSettings:previous.itemSettings??{},enabledModules:previous.enabledModules}})}
});

test("A058 native item photo API enforces company role and Items OFF and strips storage keys",async({request})=>{
 test.setTimeout(120000);const previous=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),service=await db.accountService.create({data:{companyId,name:`Native photo ${randomUUID().slice(0,8)}`}});
 await db.accountSettings.update({where:{companyId},data:{itemSettings:{...previous.itemSettings as object,enabled:true}}});
 const bytes=await (await import("sharp")).default({create:{width:10,height:10,channels:3,background:"blue"}}).png().toBuffer();
 try{
  const login=await request.post("/api/v1/mobile/auth/login",{data:{identifier:email,password,deviceId:randomUUID(),deviceName:"Item photo API"}});expect(login.status()).toBe(200);const headers={authorization:`Bearer ${(await login.json()).accessToken}`},path=`/api/v1/mobile/account/item-photos/services/${service.id}`;
  expect((await request.get(path)).status()).toBe(401);const upload=await request.post(path,{headers,multipart:{photo:{name:"blue.png",mimeType:"image/png",buffer:bytes}}});expect(upload.status()).toBe(200);expect(await upload.json()).toMatchObject({id:service.id,hasPhoto:true});expect((await request.get(path,{headers})).status()).toBe(200);
  const list=await request.get(`/api/v1/mobile/account/master-data/services/${service.id}`,{headers});expect(list.status()).toBe(200);const raw=await list.text();expect(raw).not.toContain("photoObjectKey");expect(raw).toContain('"hasPhoto":true');
  expect((await request.post(`/api/v1/mobile/account/item-photos/services/${randomUUID()}`,{headers,multipart:{photo:{name:"blue.png",mimeType:"image/png",buffer:bytes}}})).status()).toBe(404);
  expect((await request.post(path,{headers,multipart:{photo:{name:"bad.jpg",mimeType:"image/jpeg",buffer:Buffer.from("bad")}}})).status()).toBe(400);
  await db.accountSettings.update({where:{companyId},data:{itemSettings:{...previous.itemSettings as object,enabled:false}}});expect((await request.post(path,{headers,multipart:{photo:{name:"blue.png",mimeType:"image/png",buffer:bytes}}})).status()).toBe(403);await db.accountSettings.update({where:{companyId},data:{itemSettings:{...previous.itemSettings as object,enabled:true}}});
  await db.user.update({where:{id:userId},data:{accountRole:"DATA_ENTRY"}});expect((await request.get(path,{headers})).status()).toBe(403);expect((await request.post(path,{headers,multipart:{photo:{name:"blue.png",mimeType:"image/png",buffer:bytes}}})).status()).toBe(403);
 }finally{settingsCookies=[];await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});const row=await db.accountService.findUnique({where:{id:service.id}});if(row?.photoObjectKey)await privateStorage().delete(row.photoObjectKey).catch(()=>{});await db.accountSettings.update({where:{companyId},data:{itemSettings:previous.itemSettings??{}}})}
});

test("A058 secondary units require an explicit factor and persist through web and native item creation",async({page})=>{
 test.setTimeout(180000);
 const previous=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),tag=randomUUID().slice(0,8);
 const primary=await db.accountUnit.create({data:{companyId,name:`Bundle ${tag}`,symbol:`B${tag}`}}),secondary=await db.accountUnit.create({data:{companyId,name:`Piece ${tag}`,symbol:`P${tag}`}});
 const foreignCompany=await db.company.create({data:{name:"Foreign secondary fixture",slug:`secondary-${tag}`,productEdition:"SALESPUNCH360_ACCOUNT"}});
 const foreign=await db.accountUnit.create({data:{companyId:foreignCompany.id,name:"Foreign piece",symbol:"foreign"}});
 await db.accountSettings.update({where:{companyId},data:{itemSettings:{...previous.itemSettings as object,itemUnits:true,enabled:true}}});
 try{
  await signInSettings(page);await page.goto("/workspace/account/inventory/items/new");
  await page.getByRole("textbox",{name:"Item Name *",exact:true}).fill(`Secondary ${tag}`);
  await page.locator(".add-item-unit-pill").click();const dialog=page.getByRole("dialog",{name:"Add Item Unit",exact:true});
  await dialog.getByRole("button",{name:/Primary Unit/}).click();await dialog.getByRole("button",{name:`${primary.name.toUpperCase()} ( ${primary.symbol} )`,exact:true}).click();
  await dialog.getByRole("button",{name:/Secondary Unit/}).click();await dialog.getByRole("button",{name:`${secondary.name.toUpperCase()} ( ${secondary.symbol} )`,exact:true}).click();
  await expect(dialog.getByRole("button",{name:"Save",exact:true})).toBeDisabled();
  await dialog.getByLabel("Secondary units per primary unit",{exact:true}).fill("0");await expect(dialog.getByRole("button",{name:"Save",exact:true})).toBeDisabled();
  await dialog.getByLabel("Secondary units per primary unit",{exact:true}).fill("10");await dialog.getByRole("button",{name:"Save",exact:true}).click();
  await page.locator(".add-item-unit-pill").click();await expect(dialog.getByLabel("Secondary units per primary unit",{exact:true})).toHaveValue("10");
  expect((await new AxeBuilder({page}).include('dialog[aria-label="Add Item Unit"]').withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
  await dialog.getByRole("button",{name:"Save",exact:true}).click();await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page).toHaveURL(/\/workspace\/account\/inventory$/,{timeout:20000});
  const saved=await db.accountProduct.findFirstOrThrow({where:{companyId,name:`Secondary ${tag}`}});expect(saved.unitId).toBe(primary.id);expect(saved.secondaryUnitId).toBe(secondary.id);expect(saved.secondaryUnitsPerBase?.toString()).toBe("10");
  const token=createSessionToken(),user=await db.user.findUniqueOrThrow({where:{id:userId}});await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:user.sessionVersion}});const headers={authorization:`Bearer ${token}`};
  const data={name:`Native secondary ${tag}`,unitId:primary.id,secondaryUnitId:secondary.id,secondaryUnitsPerBase:"10",sellingRate:"10",cost:"5",taxRate:"0",creationRequestKey:randomUUID()};
  const response=await page.request.post("/api/v1/mobile/account/master-data/items",{headers,data});expect(response.status()).toBe(201);const native=await response.json();
  expect((await page.request.post("/api/v1/mobile/account/master-data/items",{headers,data})).status()).toBe(201);expect(await db.accountProduct.count({where:{companyId,creationRequestKey:data.creationRequestKey}})).toBe(1);
  const read=await page.request.get(`/api/v1/mobile/account/master-data/items/${native.id}`,{headers});expect(read.status()).toBe(200);expect(await read.json()).toMatchObject({record:{secondaryUnitId:secondary.id,secondaryUnitsPerBase:"10"}});
  for(const replacement of [{secondaryUnitsPerBase:undefined},{secondaryUnitsPerBase:"0"},{secondaryUnitId:primary.id},{secondaryUnitId:foreign.id}])expect((await page.request.post("/api/v1/mobile/account/master-data/items",{headers,data:{...data,...replacement,creationRequestKey:randomUUID()}})).status()).toBe(400);
  const service=await page.request.post("/api/v1/mobile/account/master-data/services",{headers,data:{...data,name:`Service secondary ${tag}`}});expect(service.status()).toBe(201);expect((await service.json()).secondaryUnitId).toBe(secondary.id);
  const changed=await page.request.patch(`/api/v1/mobile/account/master-data/items/${native.id}`,{headers,data:{name:data.name,unitId:secondary.id,sellingRate:"10",cost:"5",taxRate:"0"}});expect(changed.status()).toBe(200);expect(await db.accountProduct.findUniqueOrThrow({where:{id:native.id}})).toMatchObject({unitId:secondary.id,secondaryUnitId:null,secondaryUnitsPerBase:null});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await db.accountSettings.update({where:{companyId},data:{itemSettings:previous.itemSettings??{}}});await db.accountUnit.delete({where:{id:foreign.id}});await db.company.delete({where:{id:foreignCompany.id}});}
});

test("A090 expense detail schedules and money directory honor saved currency precision and dates",async({page})=>{
 test.setTimeout(120000);
 const before=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),categoryId=randomUUID(),expenseId=randomUUID(),templateId=randomUUID(),ledgerId=randomUUID(),moneyId=randomUUID(),suffix=randomUUID().slice(0,8);
 await db.ledgerAccount.create({data:{id:ledgerId,companyId,code:`DISPLAY-${suffix}`,name:`Display account ${suffix}`,accountClass:"ASSET",normalBalance:"DEBIT"}});
 await db.expenseCategory.create({data:{id:categoryId,companyId,name:`Display category ${suffix}`,scope:"EXPENSE",defaultLedgerAccountId:ledgerId}});
 await db.moneyAccount.create({data:{id:moneyId,companyId,branchId,name:`Display bank ${suffix}`,type:"BANK",ledgerAccountId:ledgerId}});
 await db.expenseTransaction.create({data:{id:expenseId,companyId,branchId,categoryId,type:"OFFICE_EXPENSE",status:"DRAFT",transactionNumber:`DISPLAY-${suffix}`,transactionDate:new Date("2026-10-13"),taxableAmount:"123.45",totalAmount:"123.45",createdById:userId}});
 await db.recurringExpenseTemplate.create({data:{id:templateId,companyId,branchId,categoryId,frequency:"MONTHLY",nextDueDate:new Date("2026-10-13"),amount:"90071992547409.91",createdById:userId,isActive:false}});
 try{
  await db.accountSettings.update({where:{companyId},data:{baseCurrency:"USD",displayDecimalPlaces:3,dateFormat:"MM/DD/YYYY"}});
  const preferences=resolveDisplayPreferences({baseCurrency:"USD",displayDecimalPlaces:3,dateFormat:"MM/DD/YYYY"});
  await signInSettings(page);await page.goto(`/workspace/account/expenses/${expenseId}`);
  const details=page.locator("dl").first();await expect(details.locator("div").filter({has:page.getByText("Total",{exact:true})}).locator("dd")).toHaveText(formatMoney("123.45",preferences));
  await expect(details.locator("div").filter({has:page.getByText("Date",{exact:true})}).locator("dd")).toHaveText("10/13/2026");
  await page.goto("/workspace/account/expenses/recurring");const schedule=page.getByRole("region",{name:`Schedule ${templateId}`,exact:true});await expect(schedule).toContainText(formatMoney("90071992547409.91",preferences));await expect(schedule).toContainText("Next due 10/13/2026");
  await page.goto(`/workspace/account/money/accounts?branchId=${branchId}`);const row=page.getByRole("listitem").filter({has:page.getByRole("link",{name:`Display bank ${suffix}`,exact:true})});await expect(row).toContainText(formatMoney("0",preferences));await expect(row).not.toContainText("₹");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expect(new AxeBuilder({page}).include("main").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).resolves.toMatchObject({violations:[]});
  expect((await db.expenseTransaction.findUniqueOrThrow({where:{id:expenseId}})).totalAmount.toString()).toBe("123.45");
 }finally{
  await db.accountSettings.update({where:{companyId},data:{baseCurrency:before.baseCurrency,displayDecimalPlaces:before.displayDecimalPlaces,dateFormat:before.dateFormat}});
  await db.recurringExpenseTemplate.delete({where:{id:templateId}});await db.expenseTransaction.delete({where:{id:expenseId}});await db.expenseCategory.delete({where:{id:categoryId}});await db.moneyAccount.delete({where:{id:moneyId}});await db.ledgerAccount.delete({where:{id:ledgerId}});
 }
});

test("A090 GST report uses saved monetary and calendar display without changing source values",async({page})=>{
 test.setTimeout(120000);
 const before=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"GST display year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
 for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
 const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
 const sale=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:customerId,issueDate:"2026-10-13",lines:[{lineType:"CUSTOM",itemName:"Display GST service",quantity:"1",rate:"123.45",taxRate:"18"}]});
 await postCommercialDocumentForActor(actor,{documentId:sale.id});const id=sale.id,number=sale.documentNumber;
 const original=await db.commercialDocument.findUniqueOrThrow({where:{id}});
 try{
  await db.accountSettings.update({where:{companyId},data:{baseCurrency:"USD",displayDecimalPlaces:3,dateFormat:"MM/DD/YYYY"}});
  await signInSettings(page);await page.goto(`/workspace/account/tax/reports?from=2026-10-01&to=2026-10-31&branchId=${branchId}`);
  const row=page.getByRole("row").filter({has:page.getByRole("cell",{name:number,exact:true})});
  await expect(row.getByRole("cell",{name:"10/13/2026",exact:true})).toBeVisible();await expect(row.getByRole("cell",{name:formatMoney("123.45",resolveDisplayPreferences({baseCurrency:"USD",displayDecimalPlaces:3})),exact:true})).toBeVisible();await expect(row).not.toContainText("₹");
  await expect(page.getByLabel("From date",{exact:true})).toHaveValue("2026-10-01");await expect(page.getByLabel("To date",{exact:true})).toHaveValue("2026-10-31");await expect(page.getByLabel("Branch",{exact:true})).toHaveValue(branchId);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await expect(new AxeBuilder({page}).include("main").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).resolves.toMatchObject({violations:[]});
  const saved=await db.commercialDocument.findUniqueOrThrow({where:{id}});expect(saved.taxableTotal.toString()).toBe("123.45");expect(saved.cgstTotal.toString()).toBe(original.cgstTotal.toString());
 }finally{
  await db.accountSettings.update({where:{companyId},data:{baseCurrency:before.baseCurrency,displayDecimalPlaces:before.displayDecimalPlaces,dateFormat:before.dateFormat}});
 }
});

test("A058 purchase preview resolves inclusive master cost and matches saved draft",async({page})=>{
 test.setTimeout(120000);
 const before=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),vendor=await db.vendor.create({data:{companyId,name:`Pricing supplier ${randomUUID().slice(0,8)}`}});
 const service=await db.accountService.create({data:{companyId,name:`Inclusive purchase ${randomUUID().slice(0,8)}`,sellingRate:"100",estimatedCost:"50",taxRate:"18",pricing:{saleTaxMode:"INCLUSIVE",purchaseTaxMode:"INCLUSIVE",enteredSalePrice:"118",enteredPurchasePrice:"59",discountType:"FIXED",discountValue:"11.8",normalizedDiscountValue:"10"}}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["PURCHASES","INVENTORY"],defaultTaxMode:"INCLUSIVE"}});
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Purchase pricing year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  await signInSettings(page);await page.goto("/workspace/account/transactions/new?type=PURCHASE_BILL");await page.getByText("Advanced purchase purpose",{exact:true}).click();await page.getByRole("combobox",{name:/^Purpose/}).selectOption("GENERAL_OFFICE");await page.getByRole("combobox",{name:/^Vendor/}).selectOption(vendor.id);await page.getByLabel("Vendor invoice number",{exact:true}).fill("PRICING-1");await page.getByLabel("Vendor invoice date",{exact:true}).fill("2026-10-13");
  await page.getByRole("combobox",{name:/^Line type/}).selectOption("SERVICE");await page.getByRole("combobox",{name:"Item",exact:true}).selectOption(service.id);await page.getByLabel("Quantity",{exact:true}).fill("3");
  const totals=page.getByLabel("Line totals",{exact:true});await expect(totals).toContainText("Tax ₹27.00");await expect(totals).toContainText("Line total ₹177.00");await expect(page.getByLabel("Rate",{exact:true})).toHaveValue("");
  await page.getByLabel("Rate",{exact:true}).fill("118");await expect(totals).toContainText("Line total ₹354.00");await page.getByLabel("Rate",{exact:true}).fill("");await expect(totals).toContainText("Line total ₹177.00");
  await page.getByRole("button",{name:"Create Draft",exact:true}).click();await expect(page).toHaveURL(/\/transactions\/[a-f0-9-]+$/,{timeout:20000});const id=page.url().split("/").at(-1)!;
  const saved=await db.commercialDocument.findUniqueOrThrow({where:{id},include:{lines:true}});expect(saved).toMatchObject({status:"DRAFT",taxMode:"INCLUSIVE"});expect(saved.grandTotal.toString()).toBe("177");expect(saved.lines[0].rate.toString()).toBe("59");expect(saved.discountTotal.toString()).toBe("0");expect(saved.taxableTotal.toString()).toBe("150");expect(saved.taxTotal.toString()).toBe("27");
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;await postCommercialDocumentForActor(actor,{documentId:id});const journalCount=await db.journalEntry.count({where:{companyId}});
  await page.goto("/workspace/account/reports");await expect(page.getByRole("link",{name:"Purchase Register",exact:true})).toBeVisible();
  const query=`from=2026-10-01&to=2026-10-31&branchId=${branchId}&vendorId=${vendor.id}`;await page.goto(`/workspace/account/reports/purchase-register?${query}`);const registerRow=page.locator("tbody tr").filter({hasText:saved.documentNumber});await expect(registerRow).toContainText("PRICING-1");await expect(registerRow).toContainText("₹177.00");await expect(registerRow).toContainText("₹27.00");
  const csv=await page.request.get(`/api/account/reports/purchase-register/csv?${query}`);expect(csv.status()).toBe(200);expect(await csv.text()).toContain("PRICING-1");
  const token=createSessionToken(),user=await db.user.findUniqueOrThrow({where:{id:userId}});await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:user.sessionVersion}});const headers={authorization:`Bearer ${token}`};
  const native=await page.request.get(`/api/v1/mobile/account/reports/purchase-register?${query}`,{headers});expect(native.status()).toBe(200);const nativeReport=await native.json();expect(nativeReport.nativeRowLinks).toContain(`/workspace/account/purchases/${id}`);expect(JSON.stringify(nativeReport.rows)).toContain("PRICING-1");expect(await db.journalEntry.count({where:{companyId}})).toBe(journalCount);
  const nativePurchase={type:"PURCHASE_BILL",branchId,partyId:vendor.id,issueDate:"2026-10-13",vendorInvoiceNumber:"NATIVE-PRICING",vendorInvoiceDate:"2026-10-13",purchasePurpose:"GENERAL_OFFICE",taxMode:"INCLUSIVE",idempotencyKey:randomUUID(),lines:[{lineType:"SERVICE",sourceId:service.id,quantity:"3",rate:"59.00",taxRate:"18"}]};
  const nativeCreate=await page.request.post("/api/v1/mobile/account/purchases",{headers,data:nativePurchase});expect(nativeCreate.status()).toBe(201);const nativeCreated=await nativeCreate.json();expect(nativeCreated.grandTotal).toBe("177");expect((await page.request.post("/api/v1/mobile/account/purchases",{headers,data:nativePurchase})).status()).toBe(201);const nativeSaved=await db.commercialDocument.findUniqueOrThrow({where:{id:nativeCreated.id},include:{lines:true}});expect(nativeSaved).toMatchObject({status:"DRAFT",taxMode:"INCLUSIVE"});expect(nativeSaved.lines[0].rate.toString()).toBe("59");expect(nativeSaved.discountTotal.toString()).toBe("0");expect(await db.commercialDocument.count({where:{companyId,creationRequestKey:nativePurchase.idempotencyKey}})).toBe(1);expect(await db.journalEntry.count({where:{companyId}})).toBe(journalCount);

  for(const report of ["profit-loss","balance-sheet"]){const financialQuery=`from=2026-10-01&to=2026-10-31&branchId=${branchId}`;await page.goto(`/workspace/account/reports/${report}?${financialQuery}`);const breakdown=page.getByRole("region",{name:"Ledger breakdown",exact:true});await expect(breakdown).toBeVisible();const group=breakdown.locator("details").filter({has:page.locator("summary").filter({hasText:report==="profit-loss"?"Expenses / COGS":"Liabilities"})});await group.locator("summary").click();await expect(group.locator("li").first()).toBeVisible();const financialCsv=await page.request.get(`/api/account/reports/${report}/csv?${financialQuery}`);expect(financialCsv.status()).toBe(200);expect(await financialCsv.text()).toContain("Ledger breakdown:");const nativeFinancial=await page.request.get(`/api/v1/mobile/account/reports/${report}?${financialQuery}`,{headers});expect(nativeFinancial.status()).toBe(200);expect((await nativeFinancial.json()).breakdown.length).toBe(report==="profit-loss"?2:4);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await expect(new AxeBuilder({page}).include('section[aria-label="Ledger breakdown"]').withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).resolves.toMatchObject({violations:[]});}
  expect(await db.journalEntry.count({where:{companyId}})).toBe(journalCount);


 }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:before.enabledModules,defaultTaxMode:before.defaultTaxMode}})}
});

test("A084 Cash Bank report applies account tabs to summaries exports and native API",async({page})=>{
 test.setTimeout(180000);
 const {createMoneyAccountForActor,createMoneyTransferForActor}=await import("../src/lib/account/money");const reportBranch=randomUUID(),tag=randomUUID().slice(0,8);
 await db.branch.create({data:{id:reportBranch,companyId,name:`Cash book ${tag}`,code:`CB${tag}`}});
 if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Cash book year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
 const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchIds:[]} as ProjectActor;
 const bank=await createMoneyAccountForActor(actor,{name:`Book bank ${tag}`,type:"BANK",branchId:reportBranch,openingBalance:"100",openingDate:"2026-09-30",creationRequestKey:randomUUID()}),cash=await createMoneyAccountForActor(actor,{name:`Book cash ${tag}`,type:"CASH",branchId:reportBranch,openingBalance:"50",openingDate:"2026-09-30",creationRequestKey:randomUUID()}),petty=await createMoneyAccountForActor(actor,{name:`Book petty ${tag}`,type:"PETTY_CASH",branchId:reportBranch,openingBalance:"5",openingDate:"2026-09-30",creationRequestKey:randomUUID()});
 await createMoneyTransferForActor(actor,{branchId:reportBranch,sourceAccountId:cash.id,destinationAccountId:bank.id,amount:"20",transferDate:"2026-10-13",idempotencyKey:randomUUID()});const journals=await db.journalEntry.count({where:{companyId}});
 await signInSettings(page);const query=`from=2026-10-01&to=2026-10-31&branchId=${reportBranch}`;await page.goto(`/workspace/account/reports/cash-bank?${query}`);
 const tabs=page.getByRole("navigation",{name:"Cash and bank account types",exact:true});await tabs.getByRole("link",{name:"Bank",exact:true}).click();await expect(page).toHaveURL(/accountType=BANK/);await expect(tabs.getByRole("link",{name:"Bank",exact:true})).toHaveAttribute("aria-current","page");await expect(page.getByRole("link",{name:"Back to reports",exact:true})).toHaveAttribute("href",new RegExp(`branchId=${reportBranch}`));await expect(page.locator("tbody")).toContainText(bank.name);await expect(page.locator("tbody")).not.toContainText(cash.name);await expect(page.locator("tbody")).not.toContainText(petty.name);await expect(page.locator("tbody tr").filter({hasText:bank.name})).toContainText("₹120.00");
 const csv=await page.request.get(`/api/account/reports/cash-bank/csv?${query}&accountType=BANK`);expect(csv.status()).toBe(200);const text=await csv.text();expect(text).toContain(bank.name);expect(text).not.toContain(cash.name);expect(text).toContain("Opening + receipts");
 const token=createSessionToken(),user=await db.user.findUniqueOrThrow({where:{id:userId}});await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:user.sessionVersion}});const headers={authorization:`Bearer ${token}`};const response=await page.request.get(`/api/v1/mobile/account/reports/cash-bank?${query}&accountType=BANK`,{headers});expect(response.status()).toBe(200);const native=await response.json();expect(native.rows.some((row:string[])=>row[0]===cash.name)).toBe(false);expect(native.summary.map((x:{value:string})=>x.value)).toEqual(["100","20","0","120"]);
 await tabs.getByRole("link",{name:"Cash",exact:true}).click();await expect(page.locator("tbody")).toContainText(cash.name);await expect(page.locator("tbody")).not.toContainText(bank.name);await expect(page.locator("tbody tr").filter({hasText:cash.name})).toContainText("₹30.00");await tabs.getByRole("link",{name:"Petty cash",exact:true}).click();await expect(page.locator("tbody tr").filter({hasText:petty.name})).toContainText("₹5.00");await tabs.getByRole("link",{name:"All accounts",exact:true}).click();await expect(page).not.toHaveURL(/accountType=/);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(new AxeBuilder({page}).include('nav[aria-label="Cash and bank account types"]').withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).resolves.toMatchObject({violations:[]});expect(await db.journalEntry.count({where:{companyId}})).toBe(journals);
});

test("A090 warehouse stock amounts and as-of date use saved display preferences",async({page})=>{
 test.setTimeout(120000);
 const before=await db.accountSettings.findUniqueOrThrow({where:{companyId}});
 const warehouse=await db.warehouse.create({data:{companyId,branchId,name:`Display warehouse ${randomUUID().slice(0,8)}`,code:`DSP-${randomUUID().slice(0,8)}`}});
 const product=await db.accountProduct.create({data:{companyId,name:`Display stock ${randomUUID().slice(0,8)}`,trackInventory:true,costPrice:"12.34",lowStockThreshold:"3"}});
 const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["INVENTORY"],itemSettings:{...before.itemSettings as object,enabled:true},baseCurrency:"USD",displayDecimalPlaces:3,dateFormat:"MM/DD/YYYY"}});
  await createStockMovementForActor(actor,"OPENING",{warehouseId:warehouse.id,productId:product.id,quantity:"2",unitCost:"12.34",movementDate:"2026-10-13",sourceType:"OPENING",sourceId:randomUUID()});
  const preferences=resolveDisplayPreferences({baseCurrency:"USD",displayDecimalPlaces:3});
  await signInSettings(page);
  for(const section of ["stock","low-stock"]){
   await page.goto(`/workspace/account/inventory/${section}?branchId=${branchId}&asOf=2026-10-13`);
   const region=page.getByRole("region",{name:"Warehouse stock positions",exact:true}),row=region.getByRole("row").filter({hasText:product.name});
   await expect(page.getByText(/As of 10\/13\/2026/)).toBeVisible();
   await expect(row).toContainText(formatMoney("12.34",preferences));await expect(row).toContainText(formatMoney("24.68",preferences));await expect(row).toContainText("2.0000");
   expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  }
  expect((await db.accountProduct.findUniqueOrThrow({where:{id:product.id}})).costPrice?.toString()).toBe("12.34");
 }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:before.enabledModules,itemSettings:before.itemSettings??{},baseCurrency:before.baseCurrency,displayDecimalPlaces:before.displayDecimalPlaces,dateFormat:before.dateFormat}})}
});

test("A082 quotation live totals agree with saved server calculation",async({page})=>{
 test.setTimeout(120000);
 const before=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),name=`Live quotation ${randomUUID().slice(0,8)}`;
 const journalCount=await db.journalEntry.count({where:{companyId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["QUOTATIONS_BOQ"],baseCurrency:"USD",displayDecimalPlaces:3}});
  await signInSettings(page);await page.goto("/workspace/account/quotations/new?documentType=ESTIMATE");
  await page.getByLabel("Branch",{exact:true}).selectOption(branchId);await page.getByLabel("Customer",{exact:true}).selectOption(customerId);
  const line=page.locator("article").filter({has:page.getByLabel("Item name",{exact:true})});
  await line.getByLabel("Item name",{exact:true}).fill(name);await line.getByLabel("Quantity",{exact:true}).fill("5");await line.getByLabel("Rate",{exact:true}).fill("70");await line.getByLabel("Tax %",{exact:true}).fill("18");
  const preview=page.getByRole("region",{name:"Quotation totals",exact:true}),preferences=resolveDisplayPreferences({baseCurrency:"USD",displayDecimalPlaces:3});
  const total=preview.locator("dl > div").filter({has:page.locator("dt").filter({hasText:/^Total amount$/})});
  await expect(total).toContainText(formatMoney("413",preferences));
  await line.getByRole("combobox",{name:"Line discount type",exact:true}).selectOption("PERCENTAGE");await line.getByRole("spinbutton",{name:"Line discount value",exact:true}).fill("10");
  await expect(total).toContainText(formatMoney("371.70",preferences));
  await line.getByLabel("Quantity",{exact:true}).fill("0");await expect(preview.getByRole("status")).toContainText("Enter valid");await expect(preview.locator("dl")).toHaveCount(0);
  await line.getByLabel("Quantity",{exact:true}).fill("5");await expect(total).toContainText(formatMoney("371.70",preferences));
  expect((await new AxeBuilder({page}).include('[aria-label="Quotation totals"]').analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.getByRole("button",{name:"Save & New",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"New estimate ready"})).toBeVisible({timeout:20000});
  const saved=await db.quotationLine.findFirstOrThrow({where:{companyId,itemName:name},include:{revision:true}});
  expect(saved.revision.grandTotal.toString()).toBe("371.7");expect(saved.revision.taxTotal.toString()).toBe("56.7");
  expect(await db.journalEntry.count({where:{companyId}})).toBe(journalCount);
 }finally{await db.accountSettings.update({where:{companyId},data:{enabledModules:before.enabledModules,baseCurrency:before.baseCurrency,displayDecimalPlaces:before.displayDecimalPlaces}})}
});

test("A082 inline party creation preserves estimate draft and required fields",async({page})=>{
 test.setTimeout(120000);
 const before=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),name=`Quotation party ${randomUUID().slice(0,8)}`,item=`Retained estimate ${randomUUID().slice(0,8)}`,fieldKey=`quote_party_${randomUUID().replaceAll("-","").slice(0,10)}`;
 const field=await db.customFieldDefinition.create({data:{companyId,entityType:"CUSTOMER",fieldKey,label:"Quotation party reference",dataType:"TEXT",isRequired:true,isActive:true,position:99}});
 const quoteField=await db.customFieldDefinition.create({data:{companyId,entityType:"QUOTATION",fieldKey,label:"Quotation context",dataType:"TEXT",isRequired:false,isActive:true,position:99}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["QUOTATIONS_BOQ"]}});
  await signInSettings(page);await page.goto("/workspace/account/quotations/new?documentType=ESTIMATE");
  await page.getByLabel("Branch",{exact:true}).selectOption(branchId);
  await page.getByLabel("Item name",{exact:true}).fill(item);await page.getByLabel("Quantity",{exact:true}).fill("5");await page.getByLabel("Rate",{exact:true}).fill("70");await page.getByLabel("Tax %",{exact:true}).fill("18");await page.getByLabel("Notes",{exact:true}).fill("Retain this draft while adding a party");
  const trigger=page.getByRole("button",{name:"Add new party",exact:true});await trigger.click();
  const dialog=page.getByRole("dialog",{name:"Add new party",exact:true});await expect(dialog).toBeVisible();expect(await dialog.getByLabel("Quotation party reference",{exact:true}).getAttribute("id")).not.toBe(await page.getByLabel("Quotation context",{exact:true}).getAttribute("id"));await expect(dialog.getByLabel("Branch",{exact:true})).toHaveValue(branchId);await expect(dialog.getByLabel("Branch",{exact:true}).locator("option")).toHaveCount(1);
  await dialog.getByLabel("Party name",{exact:true}).fill("Cancelled unsaved party");await dialog.getByRole("button",{name:"Cancel adding party",exact:true}).click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
  await expect(page.getByLabel("Item name",{exact:true})).toHaveValue(item);await expect(page.getByLabel("Quantity",{exact:true})).toHaveValue("5");await expect(page.getByLabel("Notes",{exact:true})).toHaveValue("Retain this draft while adding a party");
  expect(await db.customer.count({where:{companyId,name:"Cancelled unsaved party"}})).toBe(0);
  await trigger.click();await dialog.getByLabel("Party name",{exact:true}).fill(name);await dialog.getByLabel("Contact person",{exact:true}).fill("Searchable contact");await dialog.getByLabel("Phone",{exact:true}).fill("9876543210");
  await dialog.getByRole("button",{name:"Create party",exact:true}).click();expect(await db.customer.count({where:{companyId,name}})).toBe(0);await expect(dialog.getByLabel("Quotation party reference",{exact:true})).toBeFocused();
  await dialog.getByLabel("Quotation party reference",{exact:true}).fill("QUOTE-REFERENCE");
  expect((await new AxeBuilder({page}).include("dialog[open]").analyze()).violations).toEqual([]);
  await dialog.getByRole("button",{name:"Cancel adding party",exact:true}).focus();await page.keyboard.press("Tab");await expect(dialog.getByLabel("Branch",{exact:true})).toBeFocused();
  await dialog.getByRole("button",{name:"Create party",exact:true}).click();await expect(dialog).toHaveCount(0,{timeout:20000});
  const party=await db.customer.findFirstOrThrow({where:{companyId,name}});expect(party.branchId).toBe(branchId);expect((await db.customFieldValue.findFirstOrThrow({where:{companyId,definitionId:field.id,entityId:party.id}})).value).toBe("QUOTE-REFERENCE");
  await expect(page.getByLabel("Customer",{exact:true})).toHaveValue(party.id);await expect(page.getByLabel("Item name",{exact:true})).toHaveValue(item);await expect(page.getByLabel("Notes",{exact:true})).toHaveValue("Retain this draft while adding a party");
  await page.getByLabel("Search saved parties",{exact:true}).fill("Searchable contact");await expect(page.getByLabel("Customer",{exact:true}).locator(`option[value="${party.id}"]`)).toHaveCount(1);
  await page.getByLabel("Search saved parties",{exact:true}).fill("9876543210");await expect(page.getByLabel("Customer",{exact:true}).locator(`option[value="${party.id}"]`)).toHaveCount(1);expect(await db.quotationLine.count({where:{companyId,itemName:item}})).toBe(0);
  await page.getByRole("button",{name:"Save & New",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"New estimate ready"})).toBeVisible({timeout:20000});
  const saved=await db.quotationLine.findFirstOrThrow({where:{companyId,itemName:item},include:{revision:{include:{document:true}}}});expect(saved.revision.document.customerId).toBe(party.id);expect(saved.revision.grandTotal.toString()).toBe("413");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 }finally{await db.customFieldDefinition.update({where:{id:quoteField.id},data:{isActive:false}});await db.customFieldDefinition.update({where:{id:field.id},data:{isActive:false,isRequired:false}});await db.accountSettings.update({where:{companyId},data:{enabledModules:before.enabledModules}})}
});

test("A082 native party creation returns scoped identity and creates an estimate without posting",async({request})=>{
 test.setTimeout(120000);
 const before=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),name=`Native quotation party ${randomUUID().slice(0,8)}`,key=`native_quote_${randomUUID().replaceAll("-","").slice(0,10)}`,foreign=randomUUID();
 const field=await db.customFieldDefinition.create({data:{companyId,entityType:"CUSTOMER",fieldKey:key,label:"Native required confirmation",dataType:"BOOLEAN",isRequired:true,isActive:true}});
 await db.branch.create({data:{id:foreign,companyId:otherCompanyId,name:"Foreign native party branch",code:`NQP-${randomUUID().slice(0,8)}`}});
 const token=createSessionToken(),user=await db.user.findUniqueOrThrow({where:{id:userId}});await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:user.sessionVersion}});const headers={authorization:`Bearer ${token}`};
 const journals=await db.journalEntry.count({where:{companyId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["QUOTATIONS_BOQ"]}});
  const options=await request.get("/api/v1/mobile/account/quotations/options",{headers});expect(options.status()).toBe(200);expect((await options.json()).partyCreation.fields.some((row:{fieldKey:string})=>row.fieldKey===key)).toBe(true);
  const invalid=await request.post("/api/v1/mobile/account/master-data/customers",{headers,data:{branchId,name}});expect(invalid.status()).toBe(400);expect((await invalid.json()).fields[`customFields.${key}`]).toBeTruthy();expect(await db.customer.count({where:{companyId,name}})).toBe(0);
  const deniedBranch=await request.post("/api/v1/mobile/account/master-data/customers",{headers,data:{branchId:foreign,name,customFields:{[key]:"false"}}});expect(deniedBranch.status()).toBe(403);expect(await db.customer.count({where:{name}})).toBe(0);
  const created=await request.post("/api/v1/mobile/account/master-data/customers",{headers,data:{branchId,name,phone:"9000000001",customFields:{[key]:"false"}}});expect(created.status()).toBe(201);const body=await created.json(),party=body.record??body;expect(party).toMatchObject({branchId,name,isActive:true});expect(party.id).toBeTruthy();
  expect((await db.customFieldValue.findFirstOrThrow({where:{companyId,definitionId:field.id,entityId:party.id}})).value).toBe(false);
  const payload={creationRequestKey:randomUUID(),branchId,customerId:party.id,documentType:"ESTIMATE",issueDate:"2026-10-17",notes:"Retained native estimate",lines:[{lineType:"CUSTOM",itemName:`Native retained ${name}`,quantity:"5",rate:"70",taxRate:"18"}]};
  const saved=await request.post("/api/v1/mobile/account/quotations",{headers,data:payload});expect(saved.status()).toBe(201);const quotation=await saved.json();expect(quotation.id).toBeTruthy();const retried=await request.post("/api/v1/mobile/account/quotations",{headers,data:payload});expect(retried.status()).toBe(201);expect((await retried.json()).id).toBe(quotation.id);
  const row=await db.quotationDocument.findUniqueOrThrow({where:{id:quotation.id},include:{revisions:true}});expect(row.customerId).toBe(party.id);expect(row.revisions[0].grandTotal.toString()).toBe("413");expect(row.revisions[0].notes).toBe(payload.notes);
  await db.user.update({where:{id:userId},data:{accountRole:"PROJECT_MANAGER"}});const roleOptions=await request.get("/api/v1/mobile/account/quotations/options",{headers});expect(roleOptions.status()).toBe(200);expect((await roleOptions.json()).partyCreation).toBeUndefined();const deniedRole=await request.post("/api/v1/mobile/account/master-data/customers",{headers,data:{branchId,name:`Denied ${name}`,customFields:{[key]:"false"}}});expect(deniedRole.status()).toBe(403);expect(await db.customer.count({where:{companyId,name:`Denied ${name}`}})).toBe(0);
  await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});await db.accountSettings.update({where:{companyId},data:{enabledModules:[]}});expect((await request.get("/api/v1/mobile/account/quotations/options",{headers})).status()).toBe(200); // Quotations belong to included Basic Accounting, not optional modules.
  expect(await db.journalEntry.count({where:{companyId}})).toBe(journals);
 }finally{await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});await db.customFieldDefinition.update({where:{id:field.id},data:{isRequired:false,isActive:false}});await db.branch.delete({where:{id:foreign}});await db.accountSettings.update({where:{companyId},data:{enabledModules:before.enabledModules}})}
});

test("A082 estimate stock metadata follows the selected branch and never reserves stock",async({page})=>{
 test.setTimeout(120000);
 const before=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),second=randomUUID(),name=`Quotation stock ${randomUUID().slice(0,8)}`;
 await db.branch.create({data:{id:second,companyId,name:"Quotation stock second branch",code:`QST-${randomUUID().slice(0,8)}`}});
 const warehouses=await Promise.all([branchId,branchId,second].map((branch,index)=>db.warehouse.create({data:{companyId,branchId:branch,name:`Quotation stock ${index}`,code:`QS-${randomUUID().slice(0,8)}`}})));
 const product=await db.accountProduct.create({data:{companyId,name,trackInventory:true,salePrice:"70",costPrice:"50",taxRate:"18"}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["QUOTATIONS_BOQ","INVENTORY"],itemSettings:{...before.itemSettings as object,enabled:true,stockMaintenance:true}}});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
  for(const [index,quantity] of ["10","5","7"].entries())await createStockMovementForActor(actor,"OPENING",{warehouseId:warehouses[index].id,productId:product.id,quantity,unitCost:"50",movementDate:"2026-10-17",sourceType:"OPENING",sourceId:randomUUID()});
  const stockCount=await db.stockMovement.count({where:{companyId}}),journals=await db.journalEntry.count({where:{companyId}});
  await signInSettings(page);await page.goto("/workspace/account/quotations/new?documentType=ESTIMATE");await page.getByLabel("Branch",{exact:true}).selectOption(branchId);
  await page.getByLabel("Line type",{exact:true}).selectOption("PRODUCT");await page.getByLabel("Master item",{exact:true}).selectOption(product.id);
  const stock=page.getByText(/Recorded stock in selected branch:/);await expect(stock).toContainText("15.0000");await page.getByLabel("Quantity",{exact:true}).fill("999");await expect(stock).toContainText("15.0000");
  await page.getByLabel("Branch",{exact:true}).selectOption(second);await expect(stock).toContainText("7.0000");await page.getByLabel("Branch",{exact:true}).selectOption(branchId);await page.getByLabel("Customer",{exact:true}).selectOption(customerId);await expect(stock).toContainText("15.0000");
  const token=createSessionToken(),user=await db.user.findUniqueOrThrow({where:{id:userId}});await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:user.sessionVersion}});const headers={authorization:`Bearer ${token}`};
  const response=await page.request.get("/api/v1/mobile/account/quotations/options",{headers});expect(response.status()).toBe(200);const native=await response.json();expect(native.stock.positions.filter((row:{productId:string})=>row.productId===product.id)).toEqual(expect.arrayContaining([{productId:product.id,branchId,quantity:"15.0000"},{productId:product.id,branchId:second,quantity:"7.0000"}]));for(const row of native.stock.positions)expect(Object.keys(row).sort()).toEqual(["branchId","productId","quantity"]);
  await page.getByRole("button",{name:"Save & New",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"New estimate ready"})).toBeVisible({timeout:20000});
  expect(await db.stockMovement.count({where:{companyId}})).toBe(stockCount);expect(await db.journalEntry.count({where:{companyId}})).toBe(journals);
  await db.user.update({where:{id:userId},data:{accountRole:"DATA_ENTRY"}});const denied=await page.request.get("/api/v1/mobile/account/quotations/options",{headers});expect(denied.status()).toBe(200);const safe=await denied.json();expect(safe.stock).toBeNull();expect(safe.products.find((row:{id:string})=>row.id===product.id)).not.toHaveProperty("costPrice");
  await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});await db.accountSettings.update({where:{companyId},data:{itemSettings:{...before.itemSettings as object,enabled:false}}});expect((await (await page.request.get("/api/v1/mobile/account/quotations/options",{headers})).json()).stock).toBeNull();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 }finally{await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});await db.accountSettings.update({where:{companyId},data:{enabledModules:before.enabledModules,itemSettings:before.itemSettings??{}}})}
});

test("A082 party balance is exact scoped recoverable and ignores stale selections",async({page})=>{
 test.setTimeout(150000);
 const before=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),other=randomUUID(),foreign=randomUUID(),foreignBranch=randomUUID();
 await db.customer.create({data:{id:other,companyId,branchId,name:`Zero balance ${randomUUID().slice(0,8)}`,isAccountCustomer:true}});
 await db.branch.create({data:{id:foreignBranch,companyId:otherCompanyId,name:"Foreign balance branch",code:`QBAL-${randomUUID().slice(0,8)}`}});
 await db.customer.create({data:{id:foreign,companyId:otherCompanyId,branchId:foreignBranch,name:"Foreign balance party",isAccountCustomer:true}});
 let release:()=>void=()=>{},held=false,delay=false,failOnce=true;
 const gate=new Promise<void>(resolve=>{release=resolve});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["SALES","QUOTATIONS_BOQ"]}});
  if(!await db.financialYear.findFirst({where:{companyId}}))await db.financialYear.create({data:{companyId,name:"Party balance verification year",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
  for(const row of DEFAULT_LEDGER_ACCOUNTS)await db.ledgerAccount.upsert({where:{companyId_code:{companyId,code:row.code}},create:{companyId,code:row.code,name:row.name,accountClass:row.accountClass,normalBalance:row.normalBalance,systemKey:row.systemKey,isSystem:row.isSystem},update:{systemKey:row.systemKey}});
  const actor={...await db.user.findUniqueOrThrow({where:{id:userId}}),companyId,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
  const base=await currentPartyBalanceForActor(actor,customerId),sale=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",branchId,partyId:customerId,issueDate:"2026-10-17",lines:[{lineType:"CUSTOM",itemName:"Party balance fixture",quantity:"1",rate:"25",taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:sale.id});
  const expectedBalance=new (await import("@prisma/client")).Prisma.Decimal(base).add("25").toFixed(2),preferences=resolveDisplayPreferences(before),expectedText=formatMoney(expectedBalance,preferences),zeroText=formatMoney("0",preferences),journals=await db.journalEntry.count({where:{companyId}});
  await signInSettings(page);
  await page.route("**/workspace/account/quotations/new**",async route=>{
   const req=route.request();if(req.method()==="POST"&&req.headers()["next-action"]&&req.postData()?.includes(customerId)){
    if(failOnce){await route.abort("failed");return}
    if(delay){delay=false;const response=await route.fetch();held=true;await gate;await route.fulfill({response});return}
   }
   await route.continue();
  });
  await page.goto("/workspace/account/quotations/new?documentType=ESTIMATE");await page.getByLabel("Branch",{exact:true}).selectOption(branchId);await page.getByLabel("Customer",{exact:true}).selectOption(customerId);
  const balance=page.locator("p").filter({hasText:/^Party balance:/});await expect(balance).toContainText("Unavailable");await expect(balance).not.toContainText(zeroText);failOnce=false;await page.getByRole("button",{name:"Retry party balance",exact:true}).click();await expect(balance).toContainText(expectedText,{timeout:20000});
  await page.getByLabel("Customer",{exact:true}).selectOption(other);await expect(balance).toContainText(zeroText,{timeout:20000});delay=true;await page.getByLabel("Customer",{exact:true}).selectOption(customerId);await expect.poll(()=>held).toBe(true);await page.getByLabel("Customer",{exact:true}).selectOption(other);await expect(balance).not.toContainText(expectedText);release();await expect(balance).toContainText(zeroText,{timeout:20000});
  const token=createSessionToken(),user=await db.user.findUniqueOrThrow({where:{id:userId}});await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:user.sessionVersion}});const headers={authorization:`Bearer ${token}`},url=`/api/v1/mobile/account/quotations/party-balance?partyId=${customerId}&branchId=${branchId}`;
  const response=await page.request.get(url,{headers});expect(response.status()).toBe(200);expect(response.headers()["cache-control"]).toContain("no-store");expect(await response.json()).toEqual({partyId:customerId,branchId,balance:expectedBalance});
  expect((await page.request.get(url)).status()).toBe(401);expect((await page.request.get(`/api/v1/mobile/account/quotations/party-balance?partyId=${foreign}&branchId=${branchId}`,{headers})).status()).toBe(403);expect((await page.request.get(`/api/v1/mobile/account/quotations/party-balance?partyId=${customerId}&branchId=${foreignBranch}`,{headers})).status()).toBe(403);expect((await page.request.get(`/api/v1/mobile/account/quotations/party-balance?partyId=bad&branchId=${branchId}`,{headers})).status()).toBe(400);
  await db.user.update({where:{id:userId},data:{accountRole:"DATA_ENTRY"}});expect((await page.request.get(url,{headers})).status()).toBe(200);
  await db.user.update({where:{id:userId},data:{accountRole:"PROJECT_MANAGER"}});expect((await page.request.get(url,{headers})).status()).toBe(403);await page.goto("/workspace/account/quotations/new?documentType=ESTIMATE");await page.getByLabel("Customer",{exact:true}).selectOption(customerId);await expect(page.locator("p").filter({hasText:/^Party balance:/})).toHaveCount(0);
  expect(await db.journalEntry.count({where:{companyId}})).toBe(journals);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 }finally{release();await db.customer.deleteMany({where:{id:foreign,companyId:otherCompanyId}});await db.branch.deleteMany({where:{id:foreignBranch,companyId:otherCompanyId}});await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});await db.accountSettings.update({where:{companyId},data:{enabledModules:before.enabledModules}})}
});

test("A082 full item creation returns to the retained quotation without saving it",async({page})=>{
 test.setTimeout(150000);
 const before=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),name=`Inline quotation item ${randomUUID().slice(0,8)}`;
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["SALES","QUOTATIONS_BOQ","INVENTORY"],itemSettings:{enabled:true,itemType:"BOTH",stockMaintenance:true,itemUnits:true}}});
  await db.customFieldDefinition.createMany({data:[{companyId,entityType:"PRODUCT",fieldKey:"inline_detail",label:"Item inline detail",dataType:"TEXT",isRequired:true},{companyId,entityType:"QUOTATION",fieldKey:"inline_detail",label:"Quotation inline detail",dataType:"TEXT",isRequired:true}]});
  const documents=await db.quotationDocument.count({where:{companyId}}),journals=await db.journalEntry.count({where:{companyId}});
  await signInSettings(page);await page.goto("/workspace/account/quotations/new?documentType=ESTIMATE");await page.getByLabel("Customer",{exact:true}).selectOption(customerId);await page.getByLabel("Notes",{exact:true}).fill("Retain while adding item");await page.getByLabel("Quotation inline detail",{exact:true}).fill("Retain quote custom value");await page.getByLabel("Line type",{exact:true}).selectOption("PRODUCT");await page.getByLabel("Quantity",{exact:true}).fill("3");
  const add=page.getByRole("button",{name:"Add new item",exact:true});await add.click();let dialog=page.getByRole("dialog",{name:"Add quotation item",exact:true});await dialog.getByLabel("Item Name *",{exact:true}).fill("Cancel draft item");await dialog.getByRole("button",{name:"Cancel adding item",exact:true}).click();await expect(add).toBeFocused();await expect(page.getByLabel("Notes",{exact:true})).toHaveValue("Retain while adding item");expect(await db.accountProduct.count({where:{companyId,name:"Cancel draft item"}})).toBe(0);
  let failReturn=true;
  await page.route("**/workspace/account/quotations/new**",async route=>{
   const request=route.request();if(failReturn&&request.method()==="POST"&&request.headers()["next-action"]&&request.postData()?.trim()==="[]"&&await db.accountProduct.count({where:{companyId,name}})>0){await route.abort("failed");return}await route.continue();
  });
  await add.click();dialog=page.getByRole("dialog",{name:"Add quotation item",exact:true});await dialog.getByLabel("Item Name *",{exact:true}).fill(name);await dialog.getByLabel("Item inline detail",{exact:true}).fill("Reusable item metadata");expect(await page.evaluate(()=>{const ids=[...document.querySelectorAll("[id]")].map(node=>node.id);return ids.filter((id,index)=>ids.indexOf(id)!==index)})).toEqual([]);await dialog.getByRole("button",{name:"Save",exact:true}).click();await expect(dialog).toContainText("Returning to the quotation failed",{timeout:25000});expect(await db.accountProduct.count({where:{companyId,name}})).toBe(1);failReturn=false;await dialog.getByRole("button",{name:"Return to quotation",exact:true}).click();await expect(dialog).toHaveCount(0,{timeout:25000});
  const created=await db.accountProduct.findFirstOrThrow({where:{companyId,name}});expect(await db.customFieldValue.count({where:{companyId,entityId:created.id,value:{equals:"Reusable item metadata"}}})).toBe(1);await expect(page.getByLabel("Quotation inline detail",{exact:true})).toHaveValue("Retain quote custom value");await expect(page.getByLabel("Master item",{exact:true})).toHaveValue(created.id);await expect(page.getByLabel("Quantity",{exact:true})).toHaveValue("3");await expect(page.getByLabel("Notes",{exact:true})).toHaveValue("Retain while adding item");await expect(add).toBeFocused();expect(await db.accountProduct.count({where:{companyId,name}})).toBe(1);expect(await db.quotationDocument.count({where:{companyId}})).toBe(documents);expect(await db.journalEntry.count({where:{companyId}})).toBe(journals);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await db.user.update({where:{id:userId},data:{accountRole:"DATA_ENTRY"}});await page.reload();await page.getByLabel("Line type",{exact:true}).selectOption("PRODUCT");await expect(page.getByRole("button",{name:"Add new item",exact:true})).toHaveCount(0);
 }finally{await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});await db.accountSettings.update({where:{companyId},data:{enabledModules:before.enabledModules,itemSettings:before.itemSettings??{}}})}
});

test("A082 native item creation returns canonical scoped quotation options without posting",async({request})=>{
 test.setTimeout(120000);
 const before=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),name=`Native quotation item ${randomUUID().slice(0,8)}`,foreign=await db.accountProduct.create({data:{companyId:otherCompanyId,name:"Foreign quotation item",salePrice:"99"}});
 const token=createSessionToken(),user=await db.user.findUniqueOrThrow({where:{id:userId}});await db.mobileSession.create({data:{userId,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+3600000),lastUsedAt:new Date(),sessionVersion:user.sessionVersion}});const headers={authorization:`Bearer ${token}`};
 const journals=await db.journalEntry.count({where:{companyId}}),quotations=await db.quotationDocument.count({where:{companyId}}),movements=await db.stockMovement.count({where:{companyId}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["INVENTORY","QUOTATIONS_BOQ"],itemSettings:{enabled:true,itemType:"BOTH"}}});
  expect((await(await request.get("/api/v1/mobile/account/quotations/options",{headers})).json()).canCreateItem).toBe(true);
  const payload={name,creationRequestKey:randomUUID(),sellingRate:"37.15",cost:"12.34",taxRate:"18",description:"Canonical new item",trackInventory:false};
  const created=await request.post("/api/v1/mobile/account/master-data/items",{headers,data:payload});expect(created.status()).toBe(201);const body=await created.json(),item=body.record??body;
  const retried=await request.post("/api/v1/mobile/account/master-data/items",{headers,data:payload});expect(retried.status()).toBe(201);const retryBody=await retried.json();expect((retryBody.record??retryBody).id).toBe(item.id);expect(await db.accountProduct.count({where:{companyId,name}})).toBe(1);
  const options=await(await request.get("/api/v1/mobile/account/quotations/options",{headers})).json();expect(options.products.find((row:{id:string})=>row.id===item.id)).toMatchObject({name,salePrice:"37.15",taxRate:"18",description:payload.description});expect(options.products.some((row:{id:string})=>row.id===foreign.id)).toBe(false);
  const serviceResponse=await request.post("/api/v1/mobile/account/master-data/services",{headers,data:{name:`Service ${name}`,sellingRate:"19.75",cost:"4.25",taxRate:"0"}});expect(serviceResponse.status()).toBe(201);const serviceBody=await serviceResponse.json(),service=serviceBody.record??serviceBody;
  expect((await(await request.get("/api/v1/mobile/account/quotations/options",{headers})).json()).services.find((row:{id:string})=>row.id===service.id)).toMatchObject({sellingRate:"19.75",taxRate:"0"});
  await db.user.update({where:{id:userId},data:{accountRole:"DATA_ENTRY"}});const deniedOptions=await(await request.get("/api/v1/mobile/account/quotations/options",{headers})).json();expect(deniedOptions.canCreateItem).toBe(false);expect(deniedOptions.products.find((row:{id:string})=>row.id===item.id)).not.toHaveProperty("costPrice");expect((await request.post("/api/v1/mobile/account/master-data/items",{headers,data:{...payload,name:`Denied ${name}`,creationRequestKey:randomUUID()}})).status()).toBe(403);
  await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});await db.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:false}}});expect((await(await request.get("/api/v1/mobile/account/quotations/options",{headers})).json()).canCreateItem).toBe(false);const disabled=await request.post("/api/v1/mobile/account/master-data/items",{headers,data:{...payload,name:`Disabled ${name}`,creationRequestKey:randomUUID()}});expect(disabled.status()).toBe(400);expect((await disabled.json()).error).toBe("ITEMS_DISABLED");expect(await db.accountProduct.count({where:{companyId,name:{in:[`Disabled ${name}`,`Denied ${name}`]}}})).toBe(0);
  expect(await db.journalEntry.count({where:{companyId}})).toBe(journals);expect(await db.quotationDocument.count({where:{companyId}})).toBe(quotations);expect(await db.stockMovement.count({where:{companyId}})).toBe(movements);
 }finally{await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});await db.accountProduct.delete({where:{id:foreign.id}});await db.accountSettings.update({where:{companyId},data:{enabledModules:before.enabledModules,itemSettings:before.itemSettings??{}}})}
});

test("A082 saved item search matches names and codes and protects purchase cost",async({page})=>{
 test.setTimeout(120000);
 const before=await db.accountSettings.findUniqueOrThrow({where:{companyId}}),name=`Searchable quotation item ${randomUUID().slice(0,8)}`,code=`QUOTE-${randomUUID().slice(0,8)}`;
 const product=await db.accountProduct.create({data:{companyId,name,code,salePrice:"37.15",costPrice:"12.34",taxRate:"18"}}),service=await db.accountService.create({data:{companyId,name:`Service ${name}`,code:`S-${code}`,sellingRate:"19.75",estimatedCost:"4.25",taxRate:"0"}});
 try{
  await db.accountSettings.update({where:{companyId},data:{enabledModules:["INVENTORY","QUOTATIONS_BOQ"],itemSettings:{enabled:true,itemType:"BOTH"}}});await signInSettings(page);await page.goto("/workspace/account/quotations/new?documentType=ESTIMATE");await page.getByLabel("Line type",{exact:true}).selectOption("PRODUCT");await page.getByLabel("Search saved items",{exact:true}).fill(code.toLowerCase());
  const master=page.getByLabel("Master item",{exact:true});await expect(master.locator("option")).toHaveCount(2);await master.selectOption(product.id);await expect(page.getByLabel("Rate",{exact:true})).toHaveValue("37.15");await expect(page.getByText(/^Saved purchase unit cost:/)).toContainText(formatMoney("12.34",resolveDisplayPreferences(before)));await page.getByLabel("Search saved items",{exact:true}).fill("No matching item");await expect(master).toHaveValue(product.id);await expect(master.locator("option")).toHaveCount(2);
  await page.getByLabel("Line type",{exact:true}).selectOption("SERVICE");await expect(page.getByLabel("Search saved items",{exact:true})).toHaveValue("");await page.getByLabel("Search saved items",{exact:true}).fill(service.name);await master.selectOption(service.id);await expect(page.getByLabel("Rate",{exact:true})).toHaveValue("19.75");await expect(page.getByText(/^Saved estimated unit cost:/)).toContainText(formatMoney("4.25",resolveDisplayPreferences(before)));
  await db.user.update({where:{id:userId},data:{accountRole:"DATA_ENTRY"}});await page.reload();await page.getByLabel("Line type",{exact:true}).selectOption("PRODUCT");await page.getByLabel("Search saved items",{exact:true}).fill(code);await master.selectOption(product.id);await expect(page.getByText(/^Saved (purchase|estimated) unit cost:/)).toHaveCount(0);await expect(page.getByLabel("Internal estimated unit cost",{exact:true})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 }finally{await db.user.update({where:{id:userId},data:{accountRole:"ACCOUNT_ADMIN"}});await db.accountSettings.update({where:{companyId},data:{enabledModules:before.enabledModules,itemSettings:before.itemSettings??{}}})}
});
