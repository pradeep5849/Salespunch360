import{describe,expect,it}from"vitest";import{Prisma}from"@prisma/client";import{assertAdjustmentWithinSource,purchaseClassificationForPosting,selectMasterRate}from"./commercial";
const D=Prisma.Decimal,row=(taxable:string,tax:string,total:string)=>({taxableTotal:new D(taxable),taxTotal:new D(tax),grandTotal:new D(total)});
describe("commercial financial policy",()=>{
 it.each([["taxableTotal",row("101","0","90"),"ADJUSTMENT_TAXABLE_EXCEEDS_SOURCE"],["taxTotal",row("80","21","90"),"ADJUSTMENT_TAX_EXCEEDS_SOURCE"],["grandTotal",row("80","10","121"),"ADJUSTMENT_GRAND_TOTAL_EXCEEDS_SOURCE"]] as const)("caps cumulative %s",(_,current,error)=>expect(()=>assertAdjustmentWithinSource(current,row("100","20","120"),row("0","0","0"),new D(120))).toThrow(error));
 it("blocks a note against fully paid or insufficient outstanding",()=>{expect(()=>assertAdjustmentWithinSource(row("40","10","50"),row("100","20","120"),row("0","0","0"),new D(0))).toThrow("ADJUSTMENT_EXCEEDS_OUTSTANDING");expect(()=>assertAdjustmentWithinSource(row("40","10","50"),row("100","20","120"),row("0","0","0"),new D(49))).toThrow("ADJUSTMENT_EXCEEDS_OUTSTANDING")});
 it("allows an adjustment at the exact unpaid limit",()=>expect(()=>assertAdjustmentWithinSource(row("40","10","50"),row("100","20","120"),row("0","0","0"),new D(50))).not.toThrow());
 it.each([[false,"100","60","100"],[true,"100","60","60"]] as const)("selects authoritative rate for %s",(purchase,sale,cost,want)=>expect(selectMasterRate(purchase,new D(sale),new D(cost))?.toString()).toBe(want));
 it("uses the source Purchase Bill classification for Debit Note posting",()=>expect(purchaseClassificationForPosting("DEBIT_NOTE","GENERAL_EXPENSES","PURCHASE_COST")).toBe("PURCHASE_COST"));
});
