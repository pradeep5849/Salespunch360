import {beforeEach,describe,expect,it,vi} from "vitest";

const mocks=vi.hoisted(()=>({query:vi.fn(),visitFind:vi.fn(),visitUpdate:vi.fn(),leadFind:vi.fn(),leadCreate:vi.fn(),activityCreate:vi.fn(),branch:vi.fn()}));
let transactionTail=Promise.resolve();
vi.mock("@/lib/db",()=>({db:{$transaction:async<T>(work:(tx:unknown)=>Promise<T>)=>{const previous=transactionTail;let release!:()=>void;transactionTail=new Promise<void>(resolve=>{release=resolve});await previous;try{return await work({$queryRaw:mocks.query,customerVisit:{findFirst:mocks.visitFind,update:mocks.visitUpdate},lead:{findFirst:mocks.leadFind,create:mocks.leadCreate},leadActivity:{create:mocks.activityCreate}})}finally{release()}}}}));
vi.mock("@/lib/auth/authorization",()=>({requireRole:vi.fn(),requireRoleForMutation:vi.fn()}));
vi.mock("@/lib/billing/entitlement",()=>({assertOperationalWrite:vi.fn()}));
vi.mock("@/lib/branches/operational-scope",()=>({resolveOperationalWriteBranch:mocks.branch,operationalBranchContext:vi.fn()}));
vi.mock("@/lib/storage",()=>({privateStorage:vi.fn(),visitPhotoKeys:vi.fn()}));
import {addPhoneToVisitForUser} from "./service";

const user={id:"11111111-1111-4111-8111-111111111111",companyId:"22222222-2222-4222-8222-222222222222",salesRole:"SALES" as const};
const visitId="33333333-3333-4333-8333-333333333333";
let linkedLeadId:string|null;
let owner:{id:string;salesRole:string;managerId:string|null};

describe("pending visit conversion locking",()=>{
 beforeEach(()=>{vi.clearAllMocks();transactionTail=Promise.resolve();linkedLeadId=null;mocks.branch.mockResolvedValue(null);owner={id:user.id,salesRole:"SALES",managerId:null};mocks.query.mockResolvedValue([]);mocks.visitFind.mockImplementation(async()=>linkedLeadId?null:{id:visitId,userId:owner.id,user:owner,branchId:null,contactName:"Prospect",checkInLatitude:19,checkInLongitude:72});mocks.leadFind.mockResolvedValue(null);mocks.leadCreate.mockImplementation(async({data}:{data:{phone:string}})=>({id:`lead-${data.phone}`}));mocks.visitUpdate.mockImplementation(async({data}:{data:{leadId:string}})=>{linkedLeadId=data.leadId;return{id:visitId}});mocks.activityCreate.mockResolvedValue({});});
 it("allows the first conversion and rejects a second without another Lead",async()=>{await expect(addPhoneToVisitForUser(user,{visitId,phone:"9000000001"})).resolves.toMatchObject({id:"lead-9000000001"});await expect(addPhoneToVisitForUser(user,{visitId,phone:"9000000002"})).rejects.toThrow("VISIT_NOT_FOUND");expect(mocks.leadCreate).toHaveBeenCalledTimes(1);expect(linkedLeadId).toBe("lead-9000000001")});
 it("serializes concurrent different-phone conversions to exactly one Lead",async()=>{const results=await Promise.allSettled([addPhoneToVisitForUser(user,{visitId,phone:"9000000001"}),addPhoneToVisitForUser(user,{visitId,phone:"9000000002"})]);expect(results.filter(x=>x.status==="fulfilled")).toHaveLength(1);expect(results.filter(x=>x.status==="rejected")).toHaveLength(1);expect(mocks.leadCreate).toHaveBeenCalledTimes(1);expect(mocks.visitUpdate).toHaveBeenCalledTimes(1);expect(linkedLeadId).toMatch(/^lead-900000000[12]$/)});
 it.each(["ADMIN","PRIMARY_ADMIN"] as const)("keeps employee ownership and history when %s converts a pending visit",async salesRole=>{
  const actor={...user,id:"44444444-4444-4444-8444-444444444444",salesRole};
  await addPhoneToVisitForUser(actor,{visitId,phone:"9000000001"});
  expect(mocks.leadCreate).toHaveBeenCalledWith({data:expect.objectContaining({assignedUserId:owner.id,createdByUserId:actor.id,sourceVisitId:visitId,checkInReferenceLatitude:19,checkInReferenceLongitude:72})});
  expect(mocks.activityCreate).toHaveBeenCalledWith({data:expect.objectContaining({actorUserId:actor.id,newAssignedUserId:owner.id})});
 });
 it.each(["FIELD_MANAGER","MANAGER_ONLY"])("allows %s to convert only their employee's visit",async managerType=>{
  const actor={...user,id:"44444444-4444-4444-8444-444444444444",salesRole:"MANAGER" as const,managerType};owner.managerId=actor.id;
  await addPhoneToVisitForUser(actor,{visitId,phone:"9000000001"});
  expect(mocks.leadCreate).toHaveBeenCalledWith({data:expect.objectContaining({assignedUserId:owner.id,createdByUserId:actor.id})});
  expect(mocks.activityCreate).toHaveBeenCalledWith({data:expect.objectContaining({newAssignedUserId:owner.id,actorUserId:actor.id})});
 });
 it.each(["SALES","MANAGER"] as const)("rejects an unrelated %s without writes",async salesRole=>{
  const actor={...user,id:"44444444-4444-4444-8444-444444444444",salesRole};
  await expect(addPhoneToVisitForUser(actor,{visitId,phone:"9000000001"})).rejects.toThrow("VISIT_NOT_FOUND");
  expect(mocks.leadCreate).not.toHaveBeenCalled();expect(mocks.visitUpdate).not.toHaveBeenCalled();expect(mocks.activityCreate).not.toHaveBeenCalled();
 });
 it("rejects manager-to-manager delegation even when managerId matches",async()=>{
  const actor={...user,id:"44444444-4444-4444-8444-444444444444",salesRole:"MANAGER" as const};owner={...owner,salesRole:"MANAGER",managerId:actor.id};
  await expect(addPhoneToVisitForUser(actor,{visitId,phone:"9000000001"})).rejects.toThrow("VISIT_NOT_FOUND");expect(mocks.leadCreate).not.toHaveBeenCalled();
 });
 it("retains tenant-scoped pending lookup and rejects missing or foreign visits",async()=>{
  mocks.visitFind.mockResolvedValue(null);
  await expect(addPhoneToVisitForUser({...user,salesRole:"ADMIN"},{visitId,phone:"9000000001"})).rejects.toThrow("VISIT_NOT_FOUND");
  expect(mocks.visitFind).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:visitId,companyId:user.companyId,leadId:null,visitType:"NEW",OR:[{contactPhone:null},{contactPhone:""}]})}));expect(mocks.leadCreate).not.toHaveBeenCalled();
 });
 it("rejects a duplicate phone without linking or creating another lead",async()=>{
  mocks.leadFind.mockResolvedValue({id:"existing-lead"});
  await expect(addPhoneToVisitForUser(user,{visitId,phone:"9000000001"})).rejects.toThrow("SUBJECT_OWNERSHIP_CONFLICT");expect(mocks.leadCreate).not.toHaveBeenCalled();expect(mocks.visitUpdate).not.toHaveBeenCalled();
 });

 it("keeps branch write restrictions for delegated conversion",async()=>{
  mocks.branch.mockRejectedValue(new Error("BRANCH_SCOPE_DENIED"));
  await expect(addPhoneToVisitForUser({...user,salesRole:"ADMIN"},{visitId,phone:"9000000001"})).rejects.toThrow("BRANCH_SCOPE_DENIED");expect(mocks.leadCreate).not.toHaveBeenCalled();expect(mocks.visitUpdate).not.toHaveBeenCalled();expect(mocks.activityCreate).not.toHaveBeenCalled();
 });

});
