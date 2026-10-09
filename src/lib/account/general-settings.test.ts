import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),upsert:vi.fn(),audit:vi.fn(),transaction:vi.fn(),find:vi.fn(),lock:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({AuthorizationError:class extends Error{},requirePermission:vi.fn(),requirePermissionForMutation:m.auth}));
vi.mock("@/lib/db",()=>({db:{$transaction:m.transaction}}));
import {generalSettingsSchema,updateGeneralSettings} from "./settings";
const valid={appLanguage:"en",baseCurrency:"INR",displayDecimalPlaces:2,dateFormat:"DD/MM/YYYY",warnUnsavedChanges:true,appearance:"STANDARD"} as const;
describe("Account General settings",()=>{
 beforeEach(()=>{vi.clearAllMocks();m.find.mockResolvedValue({enabledModules:["PROJECTS","PROJECT_COSTING","ASSETS"]});m.transaction.mockImplementation(fn=>fn({accountSettings:{upsert:m.upsert,findUnique:m.find},accountingAuditEvent:{create:m.audit},$executeRaw:m.lock}));m.auth.mockResolvedValue({id:"user",companyId:"company",accountRole:"ACCOUNT_ADMIN"});m.upsert.mockResolvedValue(valid);m.audit.mockResolvedValue({})});
 it("accepts supported preferences and normalizes currency",()=>expect(generalSettingsSchema.parse({...valid,baseCurrency:"usd"}).baseCurrency).toBe("USD"));
 it.each([{...valid,displayDecimalPlaces:5},{...valid,dateFormat:"DD-MM-YY"},{...valid,appearance:"BLUE"}])("rejects invalid display preferences",input=>expect(()=>generalSettingsSchema.parse(input)).toThrow());
 it("persists one company-scoped source of truth and audits it",async()=>{await updateGeneralSettings(valid);expect(m.upsert).toHaveBeenCalledWith({where:{companyId:"company"},create:{companyId:"company",...valid},update:valid});expect(m.audit).toHaveBeenCalled()});
 it("disables Assets without changing the other module choices",async()=>{await updateGeneralSettings({...valid,fixedAssetsEnabled:false});expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({update:{...valid,enabledModules:["PROJECTS","PROJECT_COSTING"]}}))});
 it("enables Assets exactly once",async()=>{await updateGeneralSettings({...valid,fixedAssetsEnabled:true});expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({update:{...valid,enabledModules:["PROJECTS","PROJECT_COSTING","ASSETS"]}}))});
 it("preserves Account Admin permission enforcement",async()=>{m.auth.mockResolvedValue({id:"user",companyId:"company",accountRole:"ACCOUNTANT"});await expect(updateGeneralSettings(valid)).rejects.toThrow();expect(m.upsert).not.toHaveBeenCalled()});
});
