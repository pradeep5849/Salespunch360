import {Prisma} from "@prisma/client";
import {describe,it,expect} from "vitest";
import {commercialBaseQuantity,commercialReturnBaseQuantity} from "./commercial-stock-quantity";
const D=(value:string)=>new Prisma.Decimal(value);
const snapshot={version:1,selection:"SECONDARY",primaryUnitId:"00000000-0000-4000-8000-000000000001",secondaryUnitId:"00000000-0000-4000-8000-000000000002",secondaryUnitsPerBase:"0.1",unitName:"Box",unitSymbol:"box"};
describe("commercial stock quantities retain canonical primary units",()=>{
 it("uses retained base quantity and legacy primary fallback",()=>{expect(commercialBaseQuantity({quantity:D("1"),baseQuantity:D("10")}).toString()).toBe("10");expect(commercialBaseQuantity({quantity:D("2.5"),baseQuantity:null}).toString()).toBe("2.5")});
 it("converts physical returns with their own immutable factor",()=>{expect(commercialReturnBaseQuantity({stockReturnQuantity:D("0.5"),unitConversionSnapshot:snapshot}).toString()).toBe("5");expect(commercialReturnBaseQuantity({stockReturnQuantity:D("0.5"),unitConversionSnapshot:null}).toString()).toBe("0.5")});
 it("subtracts Project returns in base units without double conversion",()=>{expect(commercialReturnBaseQuantity({stockReturnQuantity:D("0.5"),unitConversionSnapshot:snapshot,stockReturnBaseQuantity:D("3")}).toString()).toBe("3");expect(commercialReturnBaseQuantity({stockReturnQuantity:D("0"),unitConversionSnapshot:snapshot}).toString()).toBe("0")});
 it("rejects negative,nonfinite and nonrepresentable physical returns",()=>{for(const quantity of ["-1","NaN","Infinity"])expect(()=>commercialReturnBaseQuantity({stockReturnQuantity:D(quantity)})).toThrow("INVALID_RETURN_QUANTITY");expect(()=>commercialReturnBaseQuantity({stockReturnQuantity:D("0.0001"),unitConversionSnapshot:{...snapshot,secondaryUnitsPerBase:"3"}})).toThrow("UNIT_CONVERSION_PRECISION")});
});
