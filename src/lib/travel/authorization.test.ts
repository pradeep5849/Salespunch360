import {beforeEach,describe,expect,it,vi} from "vitest";

const mocks=vi.hoisted(()=>({read:vi.fn(),mutation:vi.fn(),companyFind:vi.fn(),companyUpdate:vi.fn(),userUpdate:vi.fn(),userFind:vi.fn(),points:vi.fn(),approval:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({
 AuthorizationError:class AuthorizationError extends Error{constructor(){super("Not authorized");this.name="AuthorizationError"}},
 requirePermission:mocks.read,requirePermissionForMutation:mocks.mutation,
}));
vi.mock("@/lib/db",()=>({db:{
 company:{findUnique:mocks.companyFind,update:mocks.companyUpdate},user:{updateMany:mocks.userUpdate},
 $transaction:async(fn:(tx:unknown)=>unknown)=>fn({user:{findFirst:mocks.userFind},company:{findUnique:mocks.companyFind},locationPoint:{findMany:mocks.points},dailyTravelApproval:{upsert:mocks.approval}}),
}}));
import {companyTravelSettings,reviewDailyTravel,updateCompanyTravelRate,updateEmployeeTravelSettings} from "./service";

const companyId="company-1";
const actor=(salesRole:"PRIMARY_ADMIN"|"ADMIN"|"MANAGER"|"SALES")=>({id:"actor-1",companyId,salesRole});

describe("travel canonical authorization",()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.read.mockResolvedValue(actor("PRIMARY_ADMIN"));mocks.mutation.mockResolvedValue(actor("PRIMARY_ADMIN"));mocks.companyFind.mockResolvedValue({travelRatePerKm:"5"});mocks.companyUpdate.mockResolvedValue({});mocks.userUpdate.mockResolvedValue({count:1});mocks.userFind.mockResolvedValue({id:"employee-1",travelRatePerKm:"5"});mocks.points.mockResolvedValue([]);mocks.approval.mockResolvedValue({status:"APPROVED"})});

 it("uses SALES_SETTINGS for company reads and mutations",async()=>{await companyTravelSettings();await updateCompanyTravelRate("5");expect(mocks.read).toHaveBeenCalledWith("SALES_SETTINGS");expect(mocks.mutation).toHaveBeenCalledWith("SALES_SETTINGS")});
 it("allows a canonically authorized Primary Admin and fails closed when canonical authorization denies",async()=>{await expect(updateCompanyTravelRate("5")).resolves.toEqual({});for(const reason of ["suspended","null role","account only","legacy role only"]){mocks.mutation.mockRejectedValueOnce(new Error(reason));await expect(updateCompanyTravelRate("5")).rejects.toThrow(reason)}});
 it.each(["ADMIN","MANAGER","SALES"] as const)("denies %s employee configuration",async salesRole=>{mocks.mutation.mockResolvedValue(actor(salesRole));await expect(updateEmployeeTravelSettings("employee-1",true,null)).rejects.toThrow("Not authorized");expect(mocks.userUpdate).not.toHaveBeenCalled()});
 it("configures only active, Sales-active same-company Manager or Sales targets",async()=>{await updateEmployeeTravelSettings("employee-1",true,"7");expect(mocks.mutation).toHaveBeenCalledWith("SALES_TRAVEL");expect(mocks.userUpdate).toHaveBeenCalledWith({where:{id:"employee-1",companyId,isActive:true,salesAccessActive:true,salesRole:{in:["MANAGER","SALES"]}},data:{travelAllowanceEnabled:true,travelRatePerKm:expect.anything()}})});
 it.each(["cross-company","suspended","inactive","null sales role","legacy role alone"])("rejects an ineligible current target: %s",async()=>{mocks.userUpdate.mockResolvedValueOnce({count:0});await expect(updateEmployeeTravelSettings("employee-1",true,null)).rejects.toThrow("NOT_FOUND")});
 it.each(["ADMIN","MANAGER","SALES"] as const)("denies %s daily review",async salesRole=>{mocks.mutation.mockResolvedValue(actor(salesRole));await expect(reviewDailyTravel("employee-1","2026-09-01","APPROVED")).rejects.toThrow("Not authorized");expect(mocks.approval).not.toHaveBeenCalled()});
 it("reviews historical travel through SALES_TRAVEL without current lifecycle filters",async()=>{await expect(reviewDailyTravel("employee-1","2026-09-01","REJECTED")).resolves.toEqual({status:"APPROVED"});expect(mocks.mutation).toHaveBeenCalledWith("SALES_TRAVEL");expect(mocks.userFind).toHaveBeenCalledWith({where:{id:"employee-1",companyId,salesRole:{in:["MANAGER","SALES"]},travelAllowanceEnabled:true},select:{id:true,travelRatePerKm:true}});expect(mocks.approval).toHaveBeenCalledWith(expect.objectContaining({create:expect.objectContaining({reviewedByUserId:"actor-1",status:"REJECTED"})}))});
 it.each(["cross-company","legacy role alone"])("rejects an ineligible historical relationship: %s",async()=>{mocks.userFind.mockResolvedValueOnce(null);await expect(reviewDailyTravel("employee-1","2026-09-01","APPROVED")).rejects.toThrow("NOT_FOUND")});
});
