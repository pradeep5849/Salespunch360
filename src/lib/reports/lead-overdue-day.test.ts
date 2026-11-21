import {it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({find:vi.fn(),count:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{lead:{findMany:m.find,count:m.count}}}));
vi.mock('@/lib/branches/operational-scope',()=>({operationalBranchContext:async()=>({branchId:'branch'})}));
vi.mock('./scope',()=>({reportActor:vi.fn(),reportEmployeeOptions:async()=>[],resolveEmployeeScope:async()=>['sales']}));
import {leadReport} from './leads';
import type {ReportActor} from './scope';
it('uses the same India-day boundary for the overdue summary and filter',async()=>{vi.useFakeTimers();try{vi.setSystemTime(new Date('2026-11-21T06:00:00Z'));m.count.mockResolvedValue(3);m.find.mockResolvedValueOnce([{stage:'NEW',estimatedValue:null,sourceVisitId:null,followUpAt:new Date('2026-11-20T18:30:00Z')},{stage:'NEW',estimatedValue:null,sourceVisitId:null,followUpAt:new Date('2026-11-19T18:30:00Z')},{stage:'WON',estimatedValue:null,sourceVisitId:null,followUpAt:new Date('2026-11-19T18:30:00Z')}]).mockResolvedValueOnce([]);const result=await leadReport({start:'2026-11-01',end:'2026-11-21',followUp:'OVERDUE'},{id:'sales',companyId:'company',salesRole:'SALES'} as ReportActor);expect(result.summary.overdue).toBe(1);expect(m.count).toHaveBeenCalledWith({where:expect.objectContaining({followUpAt:{lt:new Date('2026-11-20T18:30:00Z')}})});}finally{vi.useRealTimers()}});
