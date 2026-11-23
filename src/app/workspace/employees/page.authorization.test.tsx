import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ permission: vi.fn(), context: vi.fn(), company: vi.fn(), productContext:vi.fn(),userCount:vi.fn(),workspace:vi.fn(),directory:vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/users/directory-page",()=>({directoryPageForActor:mocks.directory}));
vi.mock("@/lib/auth/web-workspace",()=>({webWorkspaceContext:mocks.workspace}));
vi.mock("@/lib/employees/service", () => ({ getEmployeeManagementContext: mocks.context }));
vi.mock("@/lib/branches/assignment",()=>({listBranchAssignmentOptions:vi.fn().mockResolvedValue([])}));
vi.mock("@/lib/users/additional-admin",()=>({listAdditionalAdmins:vi.fn().mockResolvedValue([])}));
vi.mock("@/lib/users/primary-admin",()=>({listPrimaryAdminTransferCandidates:vi.fn().mockResolvedValue([])}));
vi.mock("@/lib/db", () => ({ db: { $executeRaw:vi.fn().mockResolvedValue(0),$queryRaw:vi.fn().mockResolvedValue([]),company: { findUnique: mocks.company }, user:{count:mocks.userCount}, companySubscription:{findFirst:vi.fn().mockResolvedValue(null)} } }));
vi.mock("@/components/workspace/workspace-page-header", () => ({ WorkspacePageHeader: () => null }));
vi.mock("./employee-manager", () => ({ EmployeeManager: () => null }));
vi.mock("./product-user-manager",()=>({ProductUserManager:()=>null}));
vi.mock("@/lib/users/product-user-management",()=>({getProductUserManagementContext:mocks.productContext}));
vi.mock("@/lib/billing/entitlement",()=>({effectiveEntitlement:vi.fn().mockResolvedValue({adminUsage:0,adminLimit:0,managerUsage:0,managerLimit:1,salesUsage:0,salesLimit:5})}));

import EmployeesPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.directory.mockResolvedValue({users:[],q:"",page:1,pageSize:50,total:0,totalPages:1,hasMore:false,statistics:{total:0,inactive:0}});
  mocks.context.mockResolvedValue({
    employees: [], teamStructure: "MANAGERS_AND_SALES",
    trial: { isInTrial: false, isTrialExpired: false, effectiveStatus: "ACTIVE", managerAllowance: 1, salesAllowance: 5 },
  });
  mocks.userCount.mockResolvedValue(1);
  mocks.company.mockResolvedValue({ users: [{ emailVerifiedAt: new Date() }] });
  mocks.productContext.mockResolvedValue({actor:{salesRole:"PRIMARY_ADMIN",companyId:"company-1"},accountLimits:{},accountUsage:{},edition:"SALESPUNCH360",users:[],branches:[],canManageSalesUsers:true,canManageAccountUsers:false});
  mocks.workspace.mockResolvedValue({effectiveWorkspace:"SALES"});
});

describe("Employee page authorization", () => {
  it("allows Primary Admin Sales management", async () => {
    await expect(EmployeesPage({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
    expect(mocks.directory).toHaveBeenCalledWith(expect.anything(),"sales",{});
    expect(mocks.context).not.toHaveBeenCalled();
  });

  it("does not elevate Additional Admin to mutation authority", async () => {
    mocks.productContext.mockResolvedValue({actor:{salesRole:"ADMIN",companyId:"company-1"},accountLimits:{},accountUsage:{},edition:"SALESPUNCH360",users:[],branches:[],canManageSalesUsers:false,canManageAccountUsers:false});
    await expect(EmployeesPage({searchParams:Promise.resolve({})})).resolves.toBeTruthy();
    expect(mocks.directory).not.toHaveBeenCalled();
  });

  it("lets a Plus Account Admin open Account management without invoking Sales loaders",async()=>{
    mocks.productContext.mockResolvedValue({actor:{salesRole:"PRIMARY_ADMIN",companyId:"company-1"},accountLimits:{},accountUsage:{},edition:"SALESPUNCH360_PLUS",users:[],branches:[],canManageSalesUsers:false,canManageAccountUsers:true});
    mocks.workspace.mockResolvedValue({effectiveWorkspace:"ACCOUNT"});
    await expect(EmployeesPage({searchParams:Promise.resolve({})})).resolves.toBeTruthy();
    expect(mocks.context).not.toHaveBeenCalled();
  });

  it("loads Sales management but not Account controls for a Sales-only Primary Admin",async()=>{
    await expect(EmployeesPage({searchParams:Promise.resolve({})})).resolves.toBeTruthy();
    expect(mocks.directory).toHaveBeenCalledWith(expect.anything(),"sales",{});
    expect(mocks.context).not.toHaveBeenCalled();
  });

  it("lets an Account-only Company administrator avoid every Sales-only service",async()=>{
    mocks.productContext.mockResolvedValue({actor:{salesRole:"PRIMARY_ADMIN",companyId:"company-1"},accountLimits:{},accountUsage:{},edition:"SALESPUNCH360_ACCOUNT",users:[],branches:[],canManageSalesUsers:false,canManageAccountUsers:true});
    mocks.workspace.mockResolvedValue({effectiveWorkspace:"ACCOUNT"});
    await expect(EmployeesPage({searchParams:Promise.resolve({})})).resolves.toBeTruthy();
    expect(mocks.context).not.toHaveBeenCalled();
  });
});

it('renders bounded page controls retaining server search and role filter',async()=>{
 const {renderToStaticMarkup}=await import('react-dom/server');
 mocks.directory.mockResolvedValue({users:[{id:'employee',name:'Asha',email:'asha@example.invalid',isActive:true,salesRole:'SALES',accountRole:null,managerType:null,salesAccessActive:true,accountAccessActive:false}],q:'Asha %_',page:2,pageSize:50,total:121,totalPages:3,hasMore:true,statistics:{total:152,inactive:1}});
 const params={q:'Asha %_',filter:'sales',page:'2'};
 const html=renderToStaticMarkup(await EmployeesPage({searchParams:Promise.resolve(params)}));
 expect(mocks.directory).toHaveBeenCalledWith(expect.anything(),'sales',params);
 expect(html).toContain('Asha');expect(html).toContain('Page 2 of 3');expect(html).toContain('q=Asha+%25_');expect(html).toContain('filter=sales');expect(html).toContain('page=1');expect(html).toContain('page=3');
});
