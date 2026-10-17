import {expect,it} from "vitest";
import {quantityInBaseUnits,rateInSelectedUnits} from "./unit-quantities";
it("one bundle equals ten pieces without adding stock or value twice",()=>{
 expect(quantityInBaseUnits("1","PRIMARY","10")).toBe("1.0000");
 expect(quantityInBaseUnits("10","SECONDARY","10")).toBe("1.0000");
 expect(quantityInBaseUnits("3","SECONDARY","10")).toBe("0.3000");
 expect(rateInSelectedUnits("100","SECONDARY","10")).toBe("10.00");
 expect(rateInSelectedUnits("100","PRIMARY","10")).toBe("100.00");
});
it("preserves large exact quantities and supports fractional conversion factors",()=>{
 expect(quantityInBaseUnits("99999999999999.9999","PRIMARY")).toBe("99999999999999.9999");
 expect(quantityInBaseUnits("2.5","SECONDARY","0.5")).toBe("5.0000");
 expect(rateInSelectedUnits("9999999999999.99","SECONDARY","10")).toBe("1000000000000.00");
});
it("rejects stock fractions that cannot be stored instead of silently rounding",()=>{
 expect(()=>quantityInBaseUnits("1","SECONDARY","3")).toThrow("UNIT_CONVERSION_PRECISION");
 expect(quantityInBaseUnits("3","SECONDARY","3")).toBe("1.0000");
 expect(()=>quantityInBaseUnits("0.00001","PRIMARY")).toThrow("INVALID_UNIT_QUANTITY");
});
it.each([undefined,"0","-1","1.00001"])("requires a valid explicit factor: %s",value=>{
 expect(()=>quantityInBaseUnits("1","SECONDARY",value)).toThrow("UNIT_CONVERSION_UNAVAILABLE");
});
it.each(["0","-1","NaN","Infinity"])("rejects an invalid stock quantity: %s",quantity=>expect(()=>quantityInBaseUnits(quantity,"PRIMARY")).toThrow("INVALID_UNIT_QUANTITY"));
it("rejects quantity/rate overflow and applies existing currency rate rounding",()=>{
 expect(()=>quantityInBaseUnits("99999999999999","SECONDARY","0.0001")).toThrow("UNIT_CONVERSION_OVERFLOW");
 expect(()=>rateInSelectedUnits("9999999999999999.99","SECONDARY","0.0001")).toThrow("UNIT_CONVERSION_OVERFLOW");
 expect(rateInSelectedUnits("10","SECONDARY","3")).toBe("3.33");
});
