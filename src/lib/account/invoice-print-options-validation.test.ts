import {describe,expect,it} from "vitest";
import {invoicePrintSettingsSchema} from "./invoice-print-settings";
describe("supported invoice print options",()=>{
 it.each(["REGULAR","modern","CLASSIC","MINIMAL","#aBc123"])("accepts a supported theme %s",theme=>expect(invoicePrintSettingsSchema.parse({theme}).theme).toBe(theme));
 it.each(["unknown","#123","blue"])("rejects ineffective theme %s",theme=>expect(invoicePrintSettingsSchema.safeParse({theme}).success).toBe(false));
 it("accepts configured known columns in the requested order",()=>expect(invoicePrintSettingsSchema.parse({itemTableColumns:"qty, ITEM,AMOUNT"}).itemTableColumns).toBe("qty, ITEM,AMOUNT"));
 it.each(["ITEM,UNKNOWN","", "ITEM,,AMOUNT"])("rejects ineffective table configuration %s",itemTableColumns=>expect(invoicePrintSettingsSchema.safeParse({itemTableColumns}).success).toBe(false));
});
