import {beforeEach,expect,it,vi} from 'vitest';
import type {Prisma} from '@prisma/client';
import {verificationBudget} from './verification-budget';
import {verifyAccountDataForActor} from './utilities';
const models=['journalEntry','journalLine','commercialDocument','ledgerAccount','moneyAccount','stockMovement','project','asset','assetAssignmentHistory','warehouse','user','userBranchAccess','branch','customer','commercialDocumentLine','accountSettlement','settlementAllocation','advanceApplication','openingBalanceAllocation','financialYear','saleRevisionCredit'] as const;
const client=Object.fromEntries(models.map(name=>[name,{count:vi.fn(),findMany:vi.fn(),groupBy:vi.fn()}]));
const execute=vi.fn();
const tx={...client,$executeRaw:execute} as unknown as Prisma.TransactionClient;
beforeEach(()=>{vi.clearAllMocks();execute.mockResolvedValue(0);for(const model of Object.values(client)){model.count.mockResolvedValue(0);model.findMany.mockResolvedValue([]);model.groupBy.mockResolvedValue([])}});
it('checks company and financial-year scope before loading records and nested collections',async()=>{
 const scope={financialYearId:'year',startDate:new Date('2026-04-01'),endDate:new Date('2027-03-31')};expect(await verificationBudget(tx,'company',scope)).toEqual([]);
 expect(client.journalEntry.count).toHaveBeenCalledWith({where:{companyId:'company',financialYearId:'year'}});expect(client.journalLine.count).toHaveBeenCalledWith({where:{companyId:'company',journalEntry:{companyId:'company',financialYearId:'year'}}});expect(client.userBranchAccess.count).toHaveBeenCalledWith({where:{user:{companyId:'company'}}});expect(client.stockMovement.count).toHaveBeenCalledWith({where:{companyId:'company',movementDate:{gte:scope.startDate,lte:scope.endDate}}});
});
it('does not load records or emit PASS after a collection exceeds the interactive ceiling',async()=>{
 client.stockMovement.count.mockResolvedValue(10001);const result=await verifyAccountDataForActor({id:'admin',companyId:'company'},tx);expect(result).toHaveLength(1);expect(result[0]).toMatchObject({status:'ERROR',affected:0,incomplete:true});expect(result[0].samples).toContain('Stock movements: 10001 (limit 10000)');expect(result[0].recommendation).toContain('No PASS results');for(const model of Object.values(client)){expect(model.findMany).not.toHaveBeenCalled();expect(model.groupBy).not.toHaveBeenCalled()}
});
it('bounds nested journal lines and user branch assignments independently',async()=>{client.journalLine.count.mockResolvedValue(50001);client.userBranchAccess.count.mockResolvedValue(50002);expect(await verificationBudget(tx,'company')).toEqual([{label:'Journal lines',count:50001,limit:50000},{label:'User branch assignments',count:50002,limit:50000}])});
it('allows the exact ceiling and uses a local statement deadline before record reads',async()=>{client.journalEntry.count.mockResolvedValue(10000);client.journalLine.count.mockResolvedValue(50000);const result=await verifyAccountDataForActor({id:'admin',companyId:'company'},tx);expect(execute).toHaveBeenCalled();expect(execute.mock.invocationCallOrder[0]).toBeLessThan(client.journalEntry.count.mock.invocationCallOrder[0]);expect(client.journalEntry.findMany).toHaveBeenCalled();expect(result.some(row=>row.incomplete)).toBe(false)});
it('bounds newly reconciled document children and allocation rows before producing any partial PASS',async()=>{
 client.commercialDocumentLine.count.mockResolvedValue(50001);client.advanceApplication.count.mockResolvedValue(50002);
 const checks=await verifyAccountDataForActor({id:'admin',companyId:'company'},tx);
 expect(checks).toHaveLength(1);expect(checks[0]).toMatchObject({incomplete:true,status:'ERROR'});expect(checks[0].samples).toContain('Posted document lines: 50001 (limit 50000)');expect(checks[0].samples).toContain('Advance applications: 50002 (limit 50000)');
 for(const model of Object.values(client))expect(model.findMany).not.toHaveBeenCalled();
});
