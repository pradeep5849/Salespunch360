import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({company:vi.fn(),projects:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{company:{findUnique:m.company},project:{aggregate:m.projects}}}));
import {accountBranchDashboard} from "./branch-dashboard";
import type {AccountBranchActor,AccountBranchContext} from "./branch-context";
const actor={id:"manager",companyId:"company",accountRole:"PROJECT_MANAGER"} as AccountBranchActor;
const context={mode:"BRANCH",branchId:"allowed"} as AccountBranchContext;
beforeEach(()=>{vi.clearAllMocks();m.company.mockResolvedValue({productEdition:"SALESPUNCH360_ACCOUNT",accountSettings:{enabledModules:[]}});m.projects.mockResolvedValue({_count:1,_sum:{projectValue:null}})});
describe("A048-F01 project-only dashboard entitlement",()=>{
 it("blocks disabled Projects before fetching project counts or values",async()=>{await expect(accountBranchDashboard(actor,context,new Date(),new Date())).rejects.toThrow("MODULE_DISABLED:PROJECTS");expect(m.projects).not.toHaveBeenCalled()});
 it("keeps assigned project and branch scope when enabled",async()=>{m.company.mockResolvedValue({productEdition:"SALESPUNCH360_ACCOUNT",accountSettings:{enabledModules:["PROJECTS"]}});expect(await accountBranchDashboard(actor,context,new Date(),new Date())).toMatchObject({projectOnly:true,projects:1});expect(m.projects).toHaveBeenCalledWith({where:{companyId:"company",branchId:"allowed",projectManagerId:"manager"},_count:true,_sum:{projectValue:true}})});
});
