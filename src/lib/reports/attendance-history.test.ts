import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({find:vi.fn(),count:vi.fn(),scope:vi.fn(),branch:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{attendance:{findMany:m.find,count:m.count}}}));
vi.mock('./scope',()=>({reportActor:vi.fn(),reportEmployeeOptions:async()=>[],resolveEmployeeScope:m.scope}));
vi.mock('@/lib/branches/operational-scope',()=>({operationalBranchContext:m.branch}));
import {attendanceReport} from './attendance';
import {attendanceHistoryPage} from './attendance-history-page';
import {indiaDateBoundary} from './validation';
import type {ReportActor} from './scope';
const actor={id:'sales',companyId:'company',salesRole:'SALES'} as ReportActor;
const recent=Array.from({length:501},(_,id)=>({id:String(id),startedAt:new Date('2026-11-14T04:30:00Z'),endedAt:new Date('2026-11-14T04:31:00Z'),locationPoints:[],user:{name:'Sales',salesRole:'SALES'}}));
const older={...recent[0],id:'older',startedAt:new Date('2026-11-07T18:29:00Z'),endedAt:new Date('2026-11-07T18:30:00Z')};
const dataset=[...recent,older];
beforeEach(()=>{vi.clearAllMocks();m.scope.mockResolvedValue(['sales']);m.branch.mockResolvedValue({branchId:'branch'});m.count.mockImplementation(async args=>args.where.endedAt===null?0:dataset.length);m.find.mockImplementation(async args=>{if(args.select)return dataset;const filtered=dataset.filter(row=>row.startedAt>=args.where.startedAt.gte&&row.startedAt<args.where.startedAt.lt);return filtered.slice(args.skip,args.skip+args.take)})});
it('returns all 501 sessions of a selected day instead of a page-partial total and reaches older days',async()=>{
 const page1=await attendanceReport({start:'2026-11-01',end:'2026-11-14'},actor);
 expect(page1.rows).toHaveLength(501);expect(page1.rows.reduce((sum,row)=>sum+(row.durationMs??0),0)).toBe(501*60000);expect(page1.historyPage).toEqual({startText:'2026-11-08',endText:'2026-11-14'});expect(page1.totalPages).toBe(2);
 const page2=await attendanceReport({start:'2026-11-01',end:'2026-11-14',page:'2'},actor);expect(page2.rows.map(row=>row.id)).toEqual(['older']);expect(page2.historyPage).toEqual({startText:'2026-11-01',endText:'2026-11-07'});
 for(const [args] of m.find.mock.calls)expect(args.where).toMatchObject({companyId:'company',branchId:'branch',userId:{in:['sales']}});
});
it('retains record paging for Excel and the unselected team overview',async()=>{
 const exported=await attendanceReport({start:'2026-11-01',end:'2026-11-14',pageSize:'10000'},actor,true);expect(exported.historyPage).toBeNull();expect(exported.rows).toHaveLength(502);
 const team=await attendanceReport({start:'2026-11-01',end:'2026-11-14'},{...actor,salesRole:'PRIMARY_ADMIN'});expect(team.historyPage).toBeNull();expect(team.rows).toHaveLength(25);
});
it('makes adjacent India calendar windows without splitting midnight and clamps past the last page',()=>{
 const page=attendanceHistoryPage(indiaDateBoundary('2026-11-01'),indiaDateBoundary('2026-11-14',true),999);expect(page.page).toBe(2);expect(page.totalPages).toBe(2);expect(page.start.toISOString()).toBe('2026-10-31T18:30:00.000Z');expect(page.endExclusive.toISOString()).toBe('2026-11-07T18:30:00.000Z');
});

it('uses complete-day history for an Admin selected employee while retaining employee scope',async()=>{
 const employeeId='00000000-0000-4000-8000-000000000001';const admin={...actor,salesRole:'PRIMARY_ADMIN'} as ReportActor;
 const report=await attendanceReport({start:'2026-11-01',end:'2026-11-14',employeeId},admin);
 expect(report.rows).toHaveLength(501);expect(report.historyPage).toEqual({startText:'2026-11-08',endText:'2026-11-14'});expect(m.scope).toHaveBeenCalledWith(admin,employeeId);
});

it('rejects oversized history instead of returning a silent partial day',async()=>{
 m.find.mockImplementation(async args=>args.select?[]:Array(10001).fill(recent[0]));
 await expect(attendanceReport({start:'2026-11-01',end:'2026-11-14'},actor)).rejects.toThrow('Attendance history exceeds the interactive record limit');
});

it('does not replace the Excel ceiling with the Sales default 500-row cap',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-22T06:00:00Z'));
 try{const exported=await attendanceReport({pageSize:'10000'},actor,true);expect(exported.rows).toHaveLength(502);expect(exported.filters.pageSize).toBe(10000)}finally{vi.useRealTimers()}
});
