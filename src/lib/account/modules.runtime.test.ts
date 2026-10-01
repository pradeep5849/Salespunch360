import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),company:vi.fn(),settings:vi.fn(),upsert:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({AuthorizationError:class extends Error{},requirePermission:m.auth,requirePermissionForMutation:m.auth}));
vi.mock("@/lib/db",()=>({db:{company:{findUnique:m.company},accountSettings:{findUnique:m.settings,upsert:m.upsert}}}));
import {enabledModulesForCompany,requireAccountModules,updateModuleSettings} from "./modules";
const actor={id:"u",companyId:"c",accountRole:"ACCOUNT_ADMIN"};
describe("module runtime enforcement",()=>{
  beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue(actor);m.company.mockResolvedValue({productEdition:"SALESPUNCH360_ACCOUNT",accountSettings:{enabledModules:["SALES"]}})});
  it("returns no Account modules to Sales-only companies",async()=>{m.company.mockResolvedValue({productEdition:"SALESPUNCH360",accountSettings:null});expect(await enabledModulesForCompany("c")).toEqual([])});
  it("maps an old sparse workflow array to the complete Basic Accounting capability",async()=>expect(await enabledModulesForCompany("c")).toEqual(expect.arrayContaining(["SALES","PURCHASES","INVENTORY","GST_ADVANCED"])));
  it("safe-defaults legacy Account companies",async()=>{m.company.mockResolvedValue({productEdition:"SALESPUNCH360_ACCOUNT",accountSettings:null});expect(await enabledModulesForCompany("c")).toEqual(expect.arrayContaining(["QUOTATIONS_BOQ","PROJECTS"]))});
  it("still blocks an optional disabled module",async()=>await expect(requireAccountModules(actor,"PROJECTS")).rejects.toThrow("MODULE_DISABLED:PROJECTS"));
  it("permits core modules independent of old workflow settings",async()=>await expect(requireAccountModules(actor,"PURCHASES")).resolves.toBeUndefined());
  it("persists one business type and simplified optional choices together",async()=>{await updateModuleSettings({businessType:"WHOLESALE_DISTRIBUTION",enabledModules:["BARCODE"]});expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({update:expect.objectContaining({businessType:"WHOLESALE_DISTRIBUTION",enabledModules:expect.arrayContaining(["SALES","PURCHASES","INVENTORY","BARCODE"])})}))});
  it("rejects forged Coming Soon activation",async()=>await expect(updateModuleSettings({businessType:"OTHER_MIXED",enabledModules:["MANUFACTURING"]})).rejects.toThrow());
  it("denies non-admin module changes",async()=>{m.auth.mockResolvedValue({...actor,accountRole:"ACCOUNTANT"});await expect(updateModuleSettings({businessType:"OTHER_MIXED",enabledModules:[]})).rejects.toThrow();expect(m.upsert).not.toHaveBeenCalled()});
});
