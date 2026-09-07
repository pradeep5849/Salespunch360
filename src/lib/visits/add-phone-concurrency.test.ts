import {beforeEach,describe,expect,it,vi} from "vitest";

const mocks=vi.hoisted(()=>({query:vi.fn(),visitFind:vi.fn(),visitUpdate:vi.fn(),leadFind:vi.fn(),leadCreate:vi.fn(),activityCreate:vi.fn()}));
let transactionTail=Promise.resolve();
vi.mock("@/lib/db",()=>({db:{$transaction:async<T>(work:(tx:unknown)=>Promise<T>)=>{const previous=transactionTail;let release!:()=>void;transactionTail=new Promise<void>(resolve=>{release=resolve});await previous;try{return await work({$queryRaw:mocks.query,customerVisit:{findFirst:mocks.visitFind,update:mocks.visitUpdate},lead:{findFirst:mocks.leadFind,create:mocks.leadCreate},leadActivity:{create:mocks.activityCreate}})}finally{release()}}}}));
vi.mock("@/lib/auth/authorization",()=>({requireRole:vi.fn(),requireRoleForMutation:vi.fn()}));
vi.mock("@/lib/billing/entitlement",()=>({assertOperationalWrite:vi.fn()}));
vi.mock("@/lib/storage",()=>({privateStorage:vi.fn(),visitPhotoKeys:vi.fn()}));
import {addPhoneToVisitForUser} from "./service";

const user={id:"11111111-1111-4111-8111-111111111111",companyId:"22222222-2222-4222-8222-222222222222",salesRole:"SALES" as const};
const visitId="33333333-3333-4333-8333-333333333333";
let linkedLeadId:string|null;

describe("pending visit conversion locking",()=>{
 beforeEach(()=>{vi.clearAllMocks();transactionTail=Promise.resolve();linkedLeadId=null;mocks.query.mockResolvedValue([]);mocks.visitFind.mockImplementation(async()=>linkedLeadId?null:{id:visitId,contactName:"Prospect",checkInLatitude:19,checkInLongitude:72});mocks.leadFind.mockResolvedValue(null);mocks.leadCreate.mockImplementation(async({data}:{data:{phone:string}})=>({id:`lead-${data.phone}`}));mocks.visitUpdate.mockImplementation(async({data}:{data:{leadId:string}})=>{linkedLeadId=data.leadId;return{id:visitId}});mocks.activityCreate.mockResolvedValue({});});
 it("allows the first conversion and rejects a second without another Lead",async()=>{await expect(addPhoneToVisitForUser(user,{visitId,phone:"9000000001"})).resolves.toMatchObject({id:"lead-9000000001"});await expect(addPhoneToVisitForUser(user,{visitId,phone:"9000000002"})).rejects.toThrow("VISIT_NOT_FOUND");expect(mocks.leadCreate).toHaveBeenCalledTimes(1);expect(linkedLeadId).toBe("lead-9000000001")});
 it("serializes concurrent different-phone conversions to exactly one Lead",async()=>{const results=await Promise.allSettled([addPhoneToVisitForUser(user,{visitId,phone:"9000000001"}),addPhoneToVisitForUser(user,{visitId,phone:"9000000002"})]);expect(results.filter(x=>x.status==="fulfilled")).toHaveLength(1);expect(results.filter(x=>x.status==="rejected")).toHaveLength(1);expect(mocks.leadCreate).toHaveBeenCalledTimes(1);expect(mocks.visitUpdate).toHaveBeenCalledTimes(1);expect(linkedLeadId).toMatch(/^lead-900000000[12]$/)});
});
