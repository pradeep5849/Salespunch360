import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({projects:vi.fn(),settings:vi.fn(),modules:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{project:{findMany:m.projects},accountSettings:{findUnique:m.settings}}}));
vi.mock("./modules",()=>({enabledModulesForCompany:m.modules,requireAccountModules:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({AuthorizationError:class extends Error{constructor(){super("Not authorized")}},requirePermission:vi.fn()}));
import {assertExportRole,availableTransferTypes} from "./transfer-access";
import {exportAccountDataForActor} from "./exports";
beforeEach(()=>{vi.clearAllMocks();m.modules.mockResolvedValue(["PROJECTS","INVENTORY"]);m.settings.mockResolvedValue(null);m.projects.mockResolvedValue([])});
describe("shared master-export and assigned-project policy",()=>{
 it.each(["customers","vendors","items","chart-of-accounts"])("denies Project Manager %s exports before business-row reads",async type=>{
  await expect(exportAccountDataForActor({id:"manager",companyId:"company",accountRole:"PROJECT_MANAGER"},type,"csv")).rejects.toThrow("Not authorized");expect(m.projects).not.toHaveBeenCalled();
 });
 it("offers only scoped project exports to managers and retains explicit import capability discovery",async()=>{
  expect(await availableTransferTypes({companyId:"company",accountRole:"PROJECT_MANAGER"})).toEqual(["projects"]);
  await exportAccountDataForActor({id:"manager",companyId:"company",accountRole:"PROJECT_MANAGER",branchAccessScope:"SELECTED_BRANCHES",branchIds:["branch"]},"projects","csv");
  expect(m.projects).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:"company",projectManagerId:"manager",branchId:{in:["branch"]}}}));
  expect(await availableTransferTypes({companyId:"company",accountRole:"DATA_ENTRY"},"IMPORT")).toContain("customers");
 });
 it("keeps Account Admin/Accountant master exports and rejects other export roles",()=>{
  for(const accountRole of ["ACCOUNT_ADMIN","ACCOUNTANT"])for(const type of ["customers","vendors","items","projects","chart-of-accounts"])expect(()=>assertExportRole({accountRole},type)).not.toThrow();
  expect(()=>assertExportRole({accountRole:"DATA_ENTRY"},"customers")).toThrow("Not authorized");
 });
});
