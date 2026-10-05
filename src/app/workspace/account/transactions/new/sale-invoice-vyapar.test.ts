import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const source=readFileSync(join(process.cwd(),"src/app/workspace/account/transactions/new/sale-invoice-vyapar.tsx"),"utf8");

describe("guided sale flow",()=>{
 it("keeps saved parties and item selection in the dedicated sale flow",()=>{expect(source).toContain("Showing Saved Parties");expect(source).toContain("Add new party");expect(source).toContain("Add Items to Sale");expect(source).toContain("Showing Saved Items");expect(source).toContain("Add New Item")});
 it("has quantity rate discount tax and item save actions",()=>{expect(source).toContain("Quantity");expect(source).toContain("Rate (Price/Unit)");expect(source).toContain("Discount");expect(source).toContain("Tax %");expect(source).toContain("Save &amp; New")});
 it("opens invoice preview with five selectable themes",()=>{for(const theme of ["Theme 1","Theme 2","French Elite","GST Theme 4","GST Theme 1"])expect(source).toContain(theme);expect(source).toContain("window.print()");expect(source).toContain("shareInvoice")});
});
