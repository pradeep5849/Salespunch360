import { describe,expect,it } from "vitest";import { calculateQuotation,reconcilePaymentSchedule } from "./calculation";
describe("A3 Decimal quotation calculation",()=>{
 it("calculates quantity, GST, cost, profit and margin",()=>{const x=calculateQuotation([{quantity:"10.5000",rate:"100.10",internalUnitCost:"60",taxRate:"18"}]);expect(x.subtotal.toString()).toBe("1051.05");expect(x.taxTotal.toString()).toBe("189.19");expect(x.grandTotal.toString()).toBe("1240.24");expect(x.expectedProfit.toString()).toBe("421.05");expect(x.expectedMarginPercent.toString()).toBe("40.0599")});
 it("applies a fixed document discount before GST",()=>{const x=calculateQuotation([{quantity:1,rate:100,taxRate:18}],[{type:"DISCOUNT",valueType:"FIXED",value:10}]);expect(x.taxableTotal.toString()).toBe("90");expect(x.taxTotal.toString()).toBe("16.2");expect(x.grandTotal.toString()).toBe("106.2")});
 it("applies a percentage document discount before GST",()=>expect(calculateQuotation([{quantity:1,rate:200,taxRate:18}],[{type:"DISCOUNT",valueType:"PERCENTAGE",value:10}]).taxTotal.toString()).toBe("32.4"));
 it("allocates discounts across same-rate lines",()=>expect(calculateQuotation([{quantity:1,rate:100,taxRate:18},{quantity:1,rate:300,taxRate:18}],[{type:"DISCOUNT",valueType:"FIXED",value:40}]).lines.map(x=>x.documentDiscountAmount.toString())).toEqual(["10","30"]));
 it("allocates across multiple tax rates and recalculates each tax",()=>{const x=calculateQuotation([{quantity:1,rate:100,taxRate:5},{quantity:1,rate:100,taxRate:18}],[{type:"DISCOUNT",valueType:"FIXED",value:20}]);expect(x.lines.map(l=>l.taxAmount.toString())).toEqual(["4.5","16.2"]);expect(x.taxTotal.toString()).toBe("20.7")});
 it("assigns proportional rounding remainder exactly",()=>{const x=calculateQuotation([{quantity:1,rate:1,taxRate:18},{quantity:1,rate:1,taxRate:18},{quantity:1,rate:1,taxRate:18}],[{type:"DISCOUNT",valueType:"FIXED",value:.01}]);expect(x.lines.map(l=>l.documentDiscountAmount.toString())).toEqual(["0","0","0.01"]);expect(x.discountTotal.toString()).toBe("0.01")});
 it("combines line and document discounts",()=>{const x=calculateQuotation([{quantity:1,rate:100,taxRate:18,discountType:"PERCENTAGE",discountValue:10}],[{type:"DISCOUNT",valueType:"FIXED",value:10}]);expect(x.taxableTotal.toString()).toBe("80");expect(x.taxTotal.toString()).toBe("14.4")});
 it("allows fixed additional charges above base",()=>expect(calculateQuotation([{quantity:1,rate:500}],[{type:"ADDITIONAL_CHARGE",valueType:"FIXED",value:700}]).grandTotal.toString()).toBe("1200"));
 it("calculates taxable additional charges",()=>expect(calculateQuotation([{quantity:1,rate:100}],[{type:"ADDITIONAL_CHARGE",valueType:"FIXED",value:50,taxable:true,taxRate:18}]).taxTotal.toString()).toBe("9"));
 it("never includes GST in profit",()=>expect(calculateQuotation([{quantity:1,rate:100,internalUnitCost:60,taxRate:18}]).expectedProfit.toString()).toBe("40"));
 it.each([-1,101])("rejects invalid percentage %s",value=>expect(()=>calculateQuotation([{quantity:1,rate:100,discountType:"PERCENTAGE",discountValue:value}])).toThrow());
 it("rejects excessive discounts",()=>expect(()=>calculateQuotation([{quantity:1,rate:100}],[{type:"DISCOUNT",valueType:"FIXED",value:101}])).toThrow("EXCESSIVE"));
 it("reconciles percentage and fixed schedules",()=>{expect(reconcilePaymentSchedule([{valueType:"PERCENTAGE",value:40},{valueType:"PERCENTAGE",value:60}],118).map(String)).toEqual(["47.2","70.8"]);expect(reconcilePaymentSchedule([{valueType:"FIXED",value:40},{valueType:"FIXED",value:60}],100).map(String)).toEqual(["40","60"])});
 it("rejects zero, incomplete, mixed, negative, and zero-grand-total schedules",()=>{expect(()=>reconcilePaymentSchedule([{valueType:"PERCENTAGE",value:0}],100)).toThrow();expect(()=>reconcilePaymentSchedule([{valueType:"PERCENTAGE",value:90}],100)).toThrow();expect(()=>reconcilePaymentSchedule([{valueType:"PERCENTAGE",value:50},{valueType:"FIXED",value:50}],100)).toThrow();expect(()=>reconcilePaymentSchedule([{valueType:"FIXED",value:-1}],100)).toThrow();expect(()=>reconcilePaymentSchedule([{valueType:"PERCENTAGE",value:100}],0)).toThrow("ZERO_TOTAL")});
});

describe("quotation explicit whole-unit rounding",()=>{
 it.each([["100.49","100.00","-0.49"],["100.50","101.00","0.50"],["100.51","101.00","0.49"],["0.49","0.00","-0.49"]])("rounds %s once after tax without changing line amounts",(rate,total,offset)=>{
  const lines=[{quantity:"1",rate,taxRate:"0",internalUnitCost:"20"}],plain=calculateQuotation(lines),rounded=calculateQuotation(lines,[],{roundOffEnabled:true});
  expect(rounded.grandTotal.toFixed(2)).toBe(total);expect(rounded.roundOffAmount.toFixed(2)).toBe(offset);
  expect(rounded.lines).toEqual(plain.lines);expect(rounded.taxTotal.equals(plain.taxTotal)).toBe(true);expect(rounded.expectedProfit.equals(plain.expectedProfit)).toBe(true);
  expect(plain.roundOffAmount.isZero()).toBe(true);expect(plain.grandTotal.toFixed(2)).toBe(rate);
 });
 it("reconciles payment schedule to rounded total after discounts and taxable charges",()=>{
  const x=calculateQuotation([{quantity:"5",rate:"70.10",taxRate:"18"}],[{type:"DISCOUNT",valueType:"PERCENTAGE",value:"10"},{type:"ADDITIONAL_CHARGE",valueType:"FIXED",value:"10.25",taxable:true,taxRate:"18"}],{roundOffEnabled:true});
  expect(x.taxableTotal.add(x.taxTotal).add(x.roundOffAmount).equals(x.grandTotal)).toBe(true);
  expect(reconcilePaymentSchedule([{valueType:"PERCENTAGE",value:"100"}],x.grandTotal)[0].equals(x.grandTotal)).toBe(true);
  expect(()=>reconcilePaymentSchedule([{valueType:"FIXED",value:x.taxableTotal.add(x.taxTotal)}],x.grandTotal)).toThrow("PAYMENT_SCHEDULE_MISMATCH");
 });
});
