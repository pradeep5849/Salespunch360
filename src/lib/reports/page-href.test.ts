import {it,expect} from 'vitest';
import {reportPageHref} from './page-href';
it('keeps shared Sales report filters while replacing only page',()=>{const raw={date:'2026-11-22',status:'COMPLETED',sentiment:'POSITIVE',customerId:'customer',branchId:'branch',start:'2026-11-01',end:'2026-11-22',page:['1','9'],q:'A&B'};const next=new URLSearchParams(reportPageHref(raw,2));for(const key of ['date','status','sentiment','customerId','branchId','start','end','q'] as const)expect(next.get(key)).toBe(raw[key]);expect(next.getAll('page')).toEqual(['2'])});
