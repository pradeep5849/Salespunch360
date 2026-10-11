import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({transaction:vi.fn(),upsert:vi.fn(),audit:vi.fn(),lock:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{$transaction:m.transaction}}));
import {updateModuleSettingsForActor} from "./modules";
import {BASIC_ACCOUNTING_MODULES} from "./module-setup";
const admin={id:"admin",companyId:"company",accountRole:"ACCOUNT_ADMIN"};
describe("Module Selection persistence",()=>{
 beforeEach(()=>{vi.clearAllMocks();m.transaction.mockImplementation(fn=>fn({$executeRaw:m.lock,accountSettings:{upsert:m.upsert},accountingAuditEvent:{create:m.audit}}));m.upsert.mockResolvedValue({id:"settings"});});
 it("keeps core accounting and project costing dependencies, deduplicates choices and records the same company audit",async()=>{
  await updateModuleSettingsForActor(admin,{businessType:"INTERIOR_CONSTRUCTION",enabledModules:["PROJECTS","PROJECTS","ASSETS"]});
  expect(m.lock).toHaveBeenCalled();
  expect(m.upsert).toHaveBeenCalledWith({where:{companyId:"company"},create:{companyId:"company",businessType:"INTERIOR_CONSTRUCTION",enabledModules:[...BASIC_ACCOUNTING_MODULES,"ASSETS","PROJECTS","PROJECT_COSTING"]},update:{businessType:"INTERIOR_CONSTRUCTION",enabledModules:[...BASIC_ACCOUNTING_MODULES,"ASSETS","PROJECTS","PROJECT_COSTING"]}});
  expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({companyId:"company",actorUserId:"admin",eventType:"SETTINGS_CHANGED",metadata:{sections:["MODULES"],businessType:"INTERIOR_CONSTRUCTION",optionalModules:["ASSETS","PROJECTS"]}})}));
 });
 it("allows removing optional modules while retaining core accounting",async()=>{
  await updateModuleSettingsForActor(admin,{businessType:"OTHER_MIXED",enabledModules:[]});
  expect(m.upsert.mock.calls[0][0].update.enabledModules).toEqual(BASIC_ACCOUNTING_MODULES);
  expect(Object.keys(m.upsert.mock.calls[0][0].update).sort()).toEqual(["businessType","enabledModules"]);
 });
 it.each(["TRANSACTION_SMS","MULTI_CURRENCY","PAYROLL_HR","SALES"])("rejects unavailable setup choice %s before writing",async choice=>{
  await expect(updateModuleSettingsForActor(admin,{businessType:"OTHER_MIXED",enabledModules:[choice]})).rejects.toThrow();
  expect(m.transaction).not.toHaveBeenCalled();
 });
 it.each([{...admin,companyId:null},{...admin,accountRole:"ACCOUNTANT"}])("requires a company administrator",async actor=>{
  await expect(updateModuleSettingsForActor(actor,{businessType:"OTHER_MIXED",enabledModules:[]})).rejects.toThrow();
  expect(m.transaction).not.toHaveBeenCalled();
 });
});
