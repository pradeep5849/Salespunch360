import {describe,it,expect} from 'vitest';
import {buildAccountNavigation} from './navigation';
const base={id:'u',companyId:'c',role:'COMPANY_ADMIN',isActive:true,managerType:null,salesRole:null,accountAccessActive:true,salesAccessActive:false,branchAccessScope:'ALL_BRANCHES',branchIds:['b']} as const;
const path='/workspace/account/accounting/accounts';
describe('advanced accounting navigation',()=>{
 it.each(['ACCOUNT_ADMIN','ACCOUNTANT'] as const)('places chart only in collapsed advanced group for %s',accountRole=>{const nav=buildAccountNavigation({...base,accountRole},'SALESPUNCH360_ACCOUNT',['SALES']);const advanced=nav.find(g=>g.label==='Advanced Accounting');expect(advanced?.expandable).toBe(true);expect(advanced?.items.some(i=>i.href===path)).toBe(true);expect(nav.filter(g=>g.label!=='Advanced Accounting').some(g=>g.items.some(i=>i.href===path))).toBe(false);});
 it.each(['PROJECT_MANAGER','DATA_ENTRY'] as const)('does not expose advanced chart to %s',accountRole=>{const nav=buildAccountNavigation({...base,accountRole},'SALESPUNCH360_ACCOUNT',['SALES']);expect(nav.some(g=>g.items.some(i=>i.href===path))).toBe(false);});
});
