import {describe,it,expect} from "vitest";
import {Prisma} from "@prisma/client";
import {commercialLineAmounts} from "./commercial-line-amounts";
import {saleLineNumbers,salePreviewTotals} from "./sale-preview-calculation";
const line={quantity:"1",rate:"120",taxRate:"18",cessRate:"2",discountType:"PERCENTAGE",discountValue:"0"};
describe("A086 authoritative sale preview rounding",()=>{
 it("decomposes retained inclusive GST and cess without charging tax twice",()=>expect(saleLineNumbers(line,"WITH")).toMatchObject({base:120,taxable:100,gstTax:18,cessTax:2,tax:20,total:120}));
 it("adds exclusive GST and cess once",()=>expect(saleLineNumbers({...line,rate:"100"},"WITHOUT")).toMatchObject({taxable:100,tax:20,total:120}));
 it("rounds entered base and percentage discount before decomposing inclusive tax",()=>expect(saleLineNumbers({...line,quantity:"3",rate:"0.335",discountValue:"33.335"},"WITH")).toMatchObject({base:1.01,disc:0.34,taxable:0.56,tax:0.11,total:0.67}));
 it("sums rounded line tax instead of taxing the aggregate",()=>expect(salePreviewTotals([{...line,rate:"0.03",cessRate:"0"},{...line,rate:"0.03",cessRate:"0"}],"WITHOUT")).toMatchObject({base:0.06,tax:0.02,total:0.08}));
 it("keeps fractional quantities and fixed discounts at the server rounding boundary",()=>{const row={...line,quantity:"0.125",rate:"100.04",discountType:"FIXED",discountValue:"0.005"};const price=commercialLineAmounts(new Prisma.Decimal(row.quantity),new Prisma.Decimal(row.rate),row.discountType,new Prisma.Decimal(row.discountValue));expect(price.baseAmount.toFixed(2)).toBe("12.51");expect(price.discountAmount.toFixed(2)).toBe("0.01");expect(saleLineNumbers(row,"WITH").total).toBe(12.5)});
 it.each(["","-1","1e9999999","invalid"])("keeps incomplete/invalid quantities editable without a render exception: %s",quantity=>expect(()=>saleLineNumbers({...line,quantity},"WITH")).not.toThrow());
 it("keeps invalid discounts rejected by the shared save-time contract",()=>expect(()=>commercialLineAmounts(new Prisma.Decimal(1),new Prisma.Decimal(100),"PERCENTAGE",new Prisma.Decimal(101))).toThrow("INVALID_DISCOUNT"));
});
