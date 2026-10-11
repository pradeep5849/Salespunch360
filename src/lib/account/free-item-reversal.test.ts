import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { adjustmentTaxableBasis, proportionalTaxReversal } from "./commercial";
const d=(value:number)=>new Prisma.Decimal(value);
describe("free-item financial reversals",()=>{
 it.each(["EXCLUSIVE","INCLUSIVE"] as const)("allows a zero-value stock return in %s mode",mode=>expect(adjustmentTaxableBasis(d(0),d(0),d(0),mode).toString()).toBe("0"));
 it("returns zero tax for a free source line",()=>expect(proportionalTaxReversal(d(0),d(0),d(0)).toString()).toBe("0"));
 it("rejects a nonzero refund or tax for a zero-value source",()=>{expect(()=>adjustmentTaxableBasis(d(0),d(0),d(1),"EXCLUSIVE")).toThrow("INVALID_ADJUSTMENT_BASIS");expect(()=>proportionalTaxReversal(d(18),d(0),d(0))).toThrow("INVALID_ADJUSTMENT_BASIS")});
});
