import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=(path:string)=>readFileSync(path,'utf8');

describe('final mobile Sales parity contracts',()=>{
 it('keeps report export authenticated and delegates workbook generation to the Web exporter',()=>{const route=read('src/app/api/v1/mobile/reports/[report]/excel/route.ts');expect(route).toContain('authenticateMobileSalesToken');expect(route).toContain('excelResponse(report,raw,actor)');expect(route).not.toContain('new ExcelJS.Workbook')});
 it('keeps GPS route sessions as separate Android map segments',()=>{const report=read('android/app/src/main/java/com/salespunch360/mobile/ui/ReportsScreen.kt');expect(report).toContain('r["segments"]');expect(report).toContain('NativeMap(segments,markers)');expect(report).not.toContain('NativeMap(listOf(segments.flatten())')});
 it('keeps follow-up employee scope server authoritative',()=>{const service=read('src/lib/mobile/follow-ups.ts');expect(service).toContain('resolveEmployeeScope(actor,employeeId)');expect(service).toContain('assignedUserId:{in:userIds}');expect(service).not.toContain('assignedUserId:user.id},statusWhere')});
 it('paginates payment history by tenant in deterministic newest-first order',()=>{const billing=read('src/lib/mobile/billing.ts');expect(billing).toContain('db.billingOrder.findMany({where:{companyId}');expect(billing).toContain('orderBy:[{createdAt:"desc"},{id:"desc"}]');expect(billing).toContain('skip:(safePage-1)*pageSize');expect(billing).toContain('hasMoreOrders:safePage*pageSize<orderCount')});
 it('does not reintroduce monthly billing in Android purchase controls',()=>{const screen=read('android/app/src/main/java/com/salespunch360/mobile/ui/SubscriptionScreen.kt');expect(screen).toContain('"SIX_MONTH" to "6 Month"');expect(screen).toContain('"YEARLY" to "Yearly"');expect(screen).not.toContain('"MONTHLY"')});
});
