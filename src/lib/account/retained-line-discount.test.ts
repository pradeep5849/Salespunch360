import {expect,it} from "vitest";
import {retainedLineDiscountValue} from "./retained-line-discount";
it("uses the recorded amount for a legacy fixed discount without changing history",()=>{
 const source={discountType:"FIXED",discountValue:null,discountAmount:"3.25"};
 expect(retainedLineDiscountValue(source)).toBe("3.25");expect(source.discountValue).toBeNull();
});
it("keeps explicit zero and percentage inputs instead of substituting an amount",()=>{
 expect(retainedLineDiscountValue({discountType:"FIXED",discountValue:"0",discountAmount:"4"})).toBe("0");
 expect(retainedLineDiscountValue({discountType:"PERCENTAGE",discountValue:"10",discountAmount:"3"})).toBe("10");
});
it("does not guess a missing percentage or a discount type",()=>{
 expect(retainedLineDiscountValue({discountType:"PERCENTAGE",discountValue:null,discountAmount:"3"})).toBeUndefined();
 expect(retainedLineDiscountValue({discountType:null,discountValue:null,discountAmount:"0"})).toBeUndefined();
});
