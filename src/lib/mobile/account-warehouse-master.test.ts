import {beforeEach,describe,expect,it,vi} from "vitest";
import type {MobileAppPrincipal} from "./auth";
const m=vi.hoisted(()=>({branch:vi.fn(),create:vi.fn(),update:vi.fn(),find:vi.fn(),transaction:vi.fn(),inventory:vi.fn(),write:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{branch:{findFirst:m.branch},$transaction:m.transaction}}));
vi.mock("@/lib/account/inventory",()=>({assertInventoryAvailable:m.inventory}));
vi.mock("@/lib/billing/entitlement",()=>({assertOperationalWrite:m.write}));
import {saveMobileAccountMaster} from "./account-master-data";
const branchId="00000000-0000-4000-8000-000000000001",warehouseId="00000000-0000-4000-8000-000000000002";
const principal:MobileAppPrincipal={id:"user",name:"Warehouse fixture",email:"warehouse@example.test",salesRole:null,managerType:null,companyId:"company",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",productEdition:"SALESPUNCH360_ACCOUNT",authorizedWorkspaces:["ACCOUNT"],branchAccessScope:"ALL_BRANCHES",branchIds:[]};
const input={branchId,name:"Warehouse",code:"WH",isDefault:true};
describe("native warehouse master scope and deactivation",()=>{
 beforeEach(()=>{vi.resetAllMocks();m.branch.mockResolvedValue({id:branchId});m.create.mockResolvedValue({id:warehouseId});m.update.mockResolvedValue({count:1});m.find.mockResolvedValue({id:warehouseId});m.transaction.mockImplementation(fn=>fn({warehouse:{create:m.create,updateMany:m.update,findUniqueOrThrow:m.find}}));});
 it("permits all-branch administrators without artificial selected-branch IDs",async()=>{
  await saveMobileAccountMaster(principal,"warehouses",input);
  expect(m.branch).toHaveBeenCalledWith({where:{id:branchId,companyId:"company",isActive:true}});
  expect(m.create).toHaveBeenCalledWith({data:{...input,isActive:undefined,address:undefined,companyId:"company"}});
 });
 it("retains explicit branch assignment checks",async()=>{
  await expect(saveMobileAccountMaster({...principal,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},"warehouses",input)).rejects.toThrow("MOBILE_FORBIDDEN");
  expect(m.create).not.toHaveBeenCalled();expect(m.transaction).not.toHaveBeenCalled();
 });
 it("rejects a missing/inactive/foreign-company branch",async()=>{
  m.branch.mockResolvedValue(null);
  await expect(saveMobileAccountMaster(principal,"warehouses",input)).rejects.toThrow("MOBILE_FORBIDDEN");
  expect(m.transaction).not.toHaveBeenCalled();
 });
 it("clears default status on deactivation and keeps company/branch update guards",async()=>{
  await saveMobileAccountMaster({...principal,branchAccessScope:"SELECTED_BRANCHES",branchIds:[branchId]},"warehouses",{...input,isActive:false},warehouseId);
  expect(m.update).toHaveBeenCalledOnce();
  expect(m.update.mock.calls[0][0]).toMatchObject({where:{id:warehouseId,companyId:"company",branchId:{in:[branchId]}},data:{isActive:false,isDefault:false}});
 });
 it("rejects Project Manager mutation before any warehouse read/write",async()=>{
  await expect(saveMobileAccountMaster({...principal,accountRole:"PROJECT_MANAGER"},"warehouses",input)).rejects.toThrow("MOBILE_FORBIDDEN");
  expect(m.branch).not.toHaveBeenCalled();expect(m.transaction).not.toHaveBeenCalled();
 });
});
