import { Prisma } from "@prisma/client";
import { describe,expect,it } from "vitest";
import { REPORT_DEFAULT_PAGE_SIZE,REPORT_MAX_DAYS,REPORT_MAX_PAGE_SIZE,REPORT_TIME_ZONE } from "./config";
import { durationMs,leadValues,orderedRoute,referenceDistance,routeDistance,visitKind } from "./metrics";
import type { ReportActor } from "./scope";
import { visibleUserWhere } from "./policy";
import { indiaDateBoundary,parseReportFilters,ReportValidationError } from "./validation";

const actor=(role:ReportActor['role'],managerType:ReportActor['managerType']=role==='MANAGER'?'FIELD_MANAGER':null):ReportActor=>({id:'self',name:'User',companyId:'tenant-a',role,managerType});
describe('report filter safety',()=>{
 it('centralizes India timezone',()=>expect(REPORT_TIME_ZONE).toBe('Asia/Kolkata'));
 it('maps India midnight to prior UTC evening',()=>expect(indiaDateBoundary('2026-08-28').toISOString()).toBe('2026-08-27T18:30:00.000Z'));
 it('maps inclusive end date to next India midnight',()=>expect(indiaDateBoundary('2026-08-28',true).toISOString()).toBe('2026-08-28T18:30:00.000Z'));
 it('rejects malformed dates',()=>expect(()=>indiaDateBoundary('28-08-2026')).toThrow(ReportValidationError));
 it('rejects impossible dates',()=>expect(()=>indiaDateBoundary('2026-02-30')).toThrow('Invalid calendar date'));
 it('rejects start after end',()=>expect(()=>parseReportFilters({start:'2026-08-29',end:'2026-08-28'})).toThrow('Start date'));
 it('rejects excessive range',()=>expect(()=>parseReportFilters({start:'2025-01-01',end:'2026-08-28'})).toThrow(`${REPORT_MAX_DAYS}`));
 it('accepts exactly 366 calendar days',()=>expect(parseReportFilters({start:'2024-01-01',end:'2024-12-31'}).endText).toBe('2024-12-31'));
 it('uses seven-day default',()=>{const f=parseReportFilters({},new Date('2026-08-28T12:00:00Z'));expect(f.startText).toBe('2026-08-22');expect(f.endText).toBe('2026-08-28')});
 it('uses default pagination',()=>expect(parseReportFilters({start:'2026-08-01',end:'2026-08-02'}).pageSize).toBe(REPORT_DEFAULT_PAGE_SIZE));
 it('rejects zero page size',()=>expect(()=>parseReportFilters({start:'2026-08-01',end:'2026-08-02',pageSize:'0'})).toThrow());
 it('rejects page size over maximum',()=>expect(()=>parseReportFilters({start:'2026-08-01',end:'2026-08-02',pageSize:String(REPORT_MAX_PAGE_SIZE+1)})).toThrow());
 it('normalizes an invalid page to one',()=>expect(parseReportFilters({start:'2026-08-01',end:'2026-08-02',page:'bad'}).page).toBe(1));
 it('ignores unknown companyId',()=>expect(parseReportFilters({start:'2026-08-01',end:'2026-08-02',companyId:'tenant-b'} as never)).not.toHaveProperty('companyId'));
});
describe('current hierarchy report scope',()=>{
 it('company admin stays in tenant and sees report roles',()=>expect(visibleUserWhere(actor('COMPANY_ADMIN'))).toEqual({companyId:'tenant-a',role:{in:['MANAGER','SALES']}}));
 it('field manager sees self and direct Sales',()=>expect(visibleUserWhere(actor('MANAGER','FIELD_MANAGER'))).toEqual({companyId:'tenant-a',OR:[{id:'self',role:'MANAGER'},{role:'SALES',managerId:'self'}]}));
 it('manager only sees direct Sales',()=>expect(visibleUserWhere(actor('MANAGER','MANAGER_ONLY'))).toEqual({companyId:'tenant-a',role:'SALES',managerId:'self'}));
 it('sales is fixed to self',()=>expect(visibleUserWhere(actor('SALES'))).toEqual({companyId:'tenant-a',id:'self'}));
});
describe('derived report metrics',()=>{
 const at=new Date('2026-01-01T00:00:00Z');
 it('calculates completed duration',()=>expect(durationMs(at,new Date(at.getTime()+60000))).toBe(60000));
 it('does not invent open duration',()=>expect(durationMs(at,null)).toBeNull());
 it('clamps corrupt negative duration',()=>expect(durationMs(at,new Date(at.getTime()-1))).toBe(0));
 it('classifies no prior record as first',()=>expect(visitKind({id:'b',checkedInAt:at},[])).toBe('FIRST VISIT'));
 it('classifies earlier timestamp as repeat',()=>expect(visitKind({id:'b',checkedInAt:at},[{id:'z',checkedInAt:new Date(at.getTime()-1)}])).toBe('REPEAT VISIT'));
 it('uses id for deterministic equal-time repeat ordering',()=>expect(visitKind({id:'b',checkedInAt:at},[{id:'a',checkedInAt:at}])).toBe('REPEAT VISIT'));
 it('does not treat later equal-time id as prior',()=>expect(visitKind({id:'a',checkedInAt:at},[{id:'b',checkedInAt:at}])).toBe('FIRST VISIT'));
 it('returns no reference distance without paired customer coordinate',()=>expect(referenceDistance({latitude:0,longitude:0},{latitude:1,longitude:null})).toBeNull());
 it('calculates customer reference distance',()=>expect(referenceDistance({latitude:0,longitude:0},{latitude:0,longitude:1})).toBeGreaterThan(111000));
 it('orders GPS points by sequence then time then id',()=>{const p=(id:string,sequenceNumber:number,ms:number)=>({id,sequenceNumber,capturedAt:new Date(ms),latitude:0,longitude:0});expect(orderedRoute([p('z',2,0),p('b',1,0),p('a',1,0)]).map(x=>x.id)).toEqual(['a','b','z'])});
 it('calculates a quality-filtered route',()=>expect(routeDistance([{latitude:0,longitude:0,accuracyMeters:5,capturedAt:new Date(0)},{latitude:0,longitude:0.001,accuracyMeters:5,capturedAt:new Date(60_000)}])).toBeGreaterThan(100));
 it('sums active Decimal pipeline and WON value only',()=>{const v=leadValues([{stage:'NEW',estimatedValue:new Prisma.Decimal('10.10')},{stage:'WON',estimatedValue:new Prisma.Decimal('20.20')},{stage:'LOST',estimatedValue:new Prisma.Decimal('99')},{stage:'PROPOSAL',estimatedValue:null}]);expect(v.pipeline.toFixed(2)).toBe('10.10');expect(v.won.toFixed(2)).toBe('20.20')});
});
