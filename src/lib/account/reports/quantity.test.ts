import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { reportQuantity, reportUnitKey } from "./quantity";
const quantity = (value: string) => new Prisma.Decimal(value);
const nos = reportUnitKey({unitName:"Number",unitSymbol:"Nos"});
const kg = reportUnitKey({unitName:"Kilogram",unitSymbol:"kg"});
describe("A084-F14 compatible report quantities",()=>{
 it("labels same-unit totals",()=>expect(reportQuantity(new Map([[nos,quantity("5")]]))).toBe("5.0000 Nos"));
 it("does not add numbers and kilograms",()=>expect(reportQuantity(new Map([[nos,quantity("2")],[kg,quantity("3")]]))).toBe("Mixed units"));
 it("retains signed credit quantities",()=>expect(reportQuantity(new Map([[kg,quantity("-1.5")]]))).toBe("-1.5000 kg"));
 it("labels missing units without assigning a fabricated unit",()=>expect(reportQuantity(new Map([[reportUnitKey({unitName:null,unitSymbol:null}),quantity("4")]]))).toBe("4.0000 (unit unspecified)"));
 it("uses saved unit names when symbols are absent",()=>expect(reportQuantity(new Map([[reportUnitKey({unitName:"Box",unitSymbol:null}),quantity("2")]]))).toBe("2.0000 Box"));
 it("does not assume equal symbols establish a unit conversion",()=>expect(reportUnitKey({unitName:"Box of 10",unitSymbol:"Box"})).not.toBe(reportUnitKey({unitName:"Box of 20",unitSymbol:"Box"})));
});
