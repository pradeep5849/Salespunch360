import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({visits:vi.fn(),query:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{$queryRaw:m.query,customerVisit:{count:async()=>1,findMany:m.visits},lead:{count:async()=>0},customer:{findMany:async()=>[]}}}));
vi.mock('./scope',()=>({resolveEmployeeScope:async()=>['employee'],reportEmployeeOptions:async()=>[]}));
vi.mock('@/lib/branches/operational-scope',()=>({operationalBranchContext:async()=>({branchId:'branch',branchIds:['branch']})}));
import {checkInReport} from './check-ins';
beforeEach(()=>vi.clearAllMocks());
it.each([{stored:'existing-lead',source:[],expected:'existing-lead'},{stored:null,source:[{id:'legacy-lead'}],expected:'legacy-lead'},{stored:'canonical',source:[{id:'legacy'}],expected:'canonical'}])('preserves canonical visit relationship with legacy fallback: $expected',async({stored,source,expected})=>{m.visits.mockResolvedValue([{id:'visit',leadId:stored,sourceLeads:source,checkedInAt:new Date('2026-11-22T01:00Z'),checkedOutAt:null,customer:null}]);const result=await checkInReport({start:'2026-11-01',end:'2026-11-22'},false,{id:'employee',name:'Employee',companyId:'company',salesRole:'SALES'});expect(result.rows[0].leadId).toBe(expected)});

it.each([{raw:{},hasDate:false},{raw:{start:'2026-11-01',end:'2026-11-22'},hasDate:true}])('keeps advanced Sales kind-summary date scope aligned with the list: $hasDate',async({raw,hasDate})=>{m.visits.mockResolvedValue([]);m.query.mockResolvedValue([{first:BigInt(0),repeat:BigInt(0)}]);await checkInReport(raw,true,{id:'employee',name:'Employee',companyId:'company',salesRole:'SALES'});expect(m.query.mock.calls[0][0].values.some((value:unknown)=>value instanceof Date)).toBe(hasDate)});
