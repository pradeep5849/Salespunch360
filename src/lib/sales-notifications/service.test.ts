import {beforeEach,describe,expect,it,vi} from "vitest";
const db=vi.hoisted(()=>({user:{findFirst:vi.fn(),findMany:vi.fn()},salesNotification:{upsert:vi.fn(),findMany:vi.fn(),count:vi.fn(),updateMany:vi.fn()},followUpTask:{findMany:vi.fn()}}));
vi.mock("@/lib/db",()=>({db}));
vi.mock("@/lib/auth/authorization",()=>({requireSalesWorkspace:vi.fn(),requireSalesWorkspaceForMutation:vi.fn()}));
import {createSalesNotification,listSalesNotificationsForActor,telecallerMayReceive} from "./service";
describe("Sales notification security and policy",()=>{beforeEach(()=>vi.clearAllMocks());it("validates recipient membership and uses an idempotent recipient/event key",async()=>{db.user.findFirst.mockResolvedValue({id:"user-a"});db.salesNotification.upsert.mockResolvedValue({id:"notification"});await createSalesNotification(db as never,{companyId:"company-a",recipientUserId:"user-a",eventType:"FOLLOW_UP_ASSIGNED",title:"Assigned",body:"Body",dedupeKey:"FOLLOW_UP_ASSIGNED:task-a"});expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({companyId:"company-a",id:"user-a"})}));expect(db.salesNotification.upsert).toHaveBeenCalledWith(expect.objectContaining({where:{recipientUserId_dedupeKey:{recipientUserId:"user-a",dedupeKey:"FOLLOW_UP_ASSIGNED:task-a"}}}))});it("does not create a cross-company notification",async()=>{db.user.findFirst.mockResolvedValue(null);await expect(createSalesNotification(db as never,{companyId:"company-a",recipientUserId:"user-b",eventType:"X",title:"x",body:"x",dedupeKey:"x"})).resolves.toBeNull();expect(db.salesNotification.upsert).not.toHaveBeenCalled()});it("always scopes list and unread count by company and recipient",async()=>{db.salesNotification.findMany.mockResolvedValue([]);db.salesNotification.count.mockResolvedValue(0);await listSalesNotificationsForActor({id:"user-a",companyId:"company-a"});expect(db.salesNotification.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:"company-a",recipientUserId:"user-a"},orderBy:[{createdAt:"desc"},{id:"desc"}]}));expect(db.salesNotification.count).toHaveBeenCalledWith({where:{companyId:"company-a",recipientUserId:"user-a",readAt:null}})});it("limits Telecaller events to follow-up lifecycle only",()=>{const telecaller={salesRole:"SALES",designation:"Telecaller"};expect(telecallerMayReceive("FOLLOW_UP_OVERDUE",telecaller)).toBe(true);for(const event of ["CHECK_IN_STARTED","ATTENDANCE_STARTED","ATTENDANCE_ENDED","LEAD_STAGE_CHANGED","TARGET_CHANGED"])expect(telecallerMayReceive(event,telecaller)).toBe(false)})});

describe('follow-up reminder delivery',()=>{
 beforeEach(()=>{vi.clearAllMocks();db.user.findFirst.mockImplementation(async({where}:{where:{id:string}})=>({id:where.id,salesRole:where.id==='tele'?'SALES':'ADMIN',designation:where.id==='tele'?'Telecaller':null}));db.user.findMany.mockResolvedValue([{id:'admin'}]);db.salesNotification.upsert.mockResolvedValue({id:'notice'});});
 const task=(id:string,dueDate:string)=>({id,companyId:'company',assignedUserId:'tele',dueDate:new Date(dueDate),lead:{id:'lead',title:'Customer'},assignedUser:{salesRole:'SALES',designation:'Telecaller',managerId:'manager'}});
 it('notifies assignee before due but only escalates overdue work to Admin and Manager',async()=>{
  const {generateFollowUpReminders}=await import('./service');db.followUpTask.findMany.mockResolvedValue([task('past','2026-11-18'),task('today','2026-11-19'),task('future','2026-11-20')]);
  await generateFollowUpReminders(new Date('2026-11-19T10:00Z'));
  const notices=db.salesNotification.upsert.mock.calls.map(([x])=>x.create);
  expect(notices.filter(n=>n.recipientUserId==='admin')).toHaveLength(1);
  expect(notices.filter(n=>n.recipientUserId==='manager')).toHaveLength(1);
  expect(notices.filter(n=>n.recipientUserId==='tele')).toHaveLength(3);
  expect(notices.find(n=>n.relatedEntityId==='future').navigationTarget).toContain('status=UPCOMING');
  expect(db.followUpTask.findMany.mock.calls[0][0].where.status).toBe('PENDING');
 });
 it('continues beyond the first batch instead of starving later tasks',async()=>{
  const {generateFollowUpReminders}=await import('./service');db.followUpTask.findMany.mockResolvedValueOnce(Array.from({length:200},(_,i)=>task(String(i),'2026-11-20'))).mockResolvedValueOnce([task('last','2026-11-20')]);
  expect((await generateFollowUpReminders(new Date('2026-11-19T10:00Z'))).processed).toBe(201);
  expect(db.followUpTask.findMany.mock.calls[1][0]).toMatchObject({cursor:{id:'199'},skip:1});
 });
 it('allows Telecaller follow-up notifications without granting field Sales access',async()=>{
  await createSalesNotification(db as never,{companyId:'company',recipientUserId:'tele',eventType:'FOLLOW_UP_ASSIGNED',title:'Assigned',body:'Follow-up',dedupeKey:'assigned:task'});
  expect(db.salesNotification.upsert).toHaveBeenCalledOnce();
  await createSalesNotification(db as never,{companyId:'company',recipientUserId:'tele',eventType:'ATTENDANCE_STARTED',title:'Attendance',body:'Other',dedupeKey:'attendance'});
  expect(db.salesNotification.upsert).toHaveBeenCalledOnce();
 });
});
