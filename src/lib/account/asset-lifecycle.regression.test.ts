import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({outer:vi.fn(),current:vi.fn(),update:vi.fn(),audit:vi.fn(),lock:vi.fn(),historyUpdate:vi.fn(),historyCreate:vi.fn(),user:vi.fn(),transaction:vi.fn()}));
vi.mock("./modules",()=>({requireAccountModules:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{asset:{findFirst:m.outer},$transaction:m.transaction}}));
import {assignAssetForActor,returnAssetForActor,setAssetStatusForActor} from "./assets";
import type {ProjectActor} from "./projects";
const a={id:"actor",companyId:"company",accountRole:"ACCOUNT_ADMIN"} as ProjectActor;
const active={id:"asset",companyId:"company",branchId:"branch",status:"ACTIVE",assignedUserId:null};
beforeEach(()=>{vi.clearAllMocks();m.outer.mockResolvedValue(active);m.current.mockResolvedValue(active);m.update.mockImplementation(({data})=>({...active,...data}));m.audit.mockResolvedValue({});m.historyUpdate.mockResolvedValue({count:1});m.user.mockResolvedValue({id:"employee"});m.transaction.mockImplementation(fn=>fn({$queryRaw:m.lock,asset:{findFirst:m.current,update:m.update},user:{findFirst:m.user},assetAssignmentHistory:{updateMany:m.historyUpdate,create:m.historyCreate},accountOperationalAudit:{create:m.audit}}))});
describe("A045-F01/F02/F03 asset lifecycle atomicity",()=>{
 it("writes status and audit through the same transaction",async()=>{await setAssetStatusForActor(a,"asset","RETIRED");expect(m.transaction).toHaveBeenCalledOnce();expect(m.lock).toHaveBeenCalledBefore(m.current);expect(m.update).toHaveBeenCalledBefore(m.audit);expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({metadata:{fromStatus:"ACTIVE",status:"RETIRED"}})}))});
 it("propagates audit failure so the transaction cannot commit status alone",async()=>{m.audit.mockRejectedValue(new Error("audit-write-failed"));await expect(setAssetStatusForActor(a,"asset","RETIRED")).rejects.toThrow("audit-write-failed")});
 it("rechecks assignment eligibility after locking instead of trusting the stale read",async()=>{m.current.mockResolvedValue({...active,status:"DISPOSED"});await expect(assignAssetForActor(a,"asset","employee")).rejects.toThrow("ASSET_NOT_ASSIGNABLE");expect(m.update).not.toHaveBeenCalled();expect(m.historyCreate).not.toHaveBeenCalled()});
 it("cannot change status when another request assigned the asset",async()=>{m.current.mockResolvedValue({...active,status:"ASSIGNED",assignedUserId:"employee"});await expect(setAssetStatusForActor(a,"asset","DISPOSED")).rejects.toThrow("RETURN_ASSET_FIRST");expect(m.update).not.toHaveBeenCalled()});
 it("preserves original assignment notes and records return notes with the return audit",async()=>{m.current.mockResolvedValue({...active,status:"ASSIGNED",assignedUserId:"employee"});await returnAssetForActor(a,"asset","Returned in good condition");expect(m.historyUpdate.mock.calls[0][0].data).not.toHaveProperty("notes");expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({metadata:{returnNotes:"Returned in good condition",returnedById:"actor"}})}))});
 it("rejects a second return before changing history",async()=>{await expect(returnAssetForActor(a,"asset")).rejects.toThrow("ASSET_NOT_ASSIGNED");expect(m.historyUpdate).not.toHaveBeenCalled()});
 it("rejects forged states and avoids duplicate status events",async()=>{await expect(setAssetStatusForActor(a,"asset","INVALID" as never)).rejects.toThrow();await setAssetStatusForActor(a,"asset","ACTIVE");expect(m.update).not.toHaveBeenCalled();expect(m.audit).not.toHaveBeenCalled()});
});
