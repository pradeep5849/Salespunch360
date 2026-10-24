import {it,expect} from "vitest";
import {validUnitConversionRate} from "./unit-conversion-rate";
it("accepts exact positive bounded rates and rejects scientific, zero and excess precision",()=>{for(const value of ["0.0001","12","99999999999999.9999","0001.2500"])expect(validUnitConversionRate(value)).toBe(true);for(const value of ["0","000.0000","-1","1e3","Infinity","0.00001","123456789012345",""])expect(validUnitConversionRate(value)).toBe(false);});
