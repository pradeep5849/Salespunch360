import {expect,it} from "vitest";
import {exportPdf,REPORT_EXPORT_LIMIT} from "../financial-reports";
import {extractPdfText} from "../../../../tests/helpers/pdf-text";
it("preserves Unicode company/party names, financial symbols, totals and scope notes",async()=>{
 const bytes=await exportPdf({title:"Financial Report",company:"José Café",columns:["Party","Amount"],rows:[["अजय सेवा ಕನ್ನಡ","₹125.00"],["Net withdrawals","125.00"],["Scope: branch=Main",""]]});
 const {text}=await extractPdfText(bytes);
 for(const value of ["José Café","अजय","सेवा","ಕನ್ನಡ","Net withdrawals","Scope: branch=Main"])expect(text).toContain(value);
 expect(text.replace(/\s/g,"")).toContain("₹125.00");
 expect(text).not.toContain("????");
});
it("wraps long content and paginates instead of clipping ledger identifiers",async()=>{
 const long="abcdefghij".repeat(20);
 const {text,pages}=await extractPdfText(await exportPdf({title:"Ledger",company:"Business",columns:["Reference","Amount"],rows:Array.from({length:90},(_,i)=>[`Row-${i} ${long}`,"1.00"])}));
 expect(pages).toBeGreaterThan(2);expect(text).toContain("Row-0");expect(text).toContain("Row-89");expect(text.replace(/\s/g,"")).toContain(long);
},15000);
it("refuses unsupported glyphs rather than corrupting names silently",async()=>{await expect(exportPdf({title:"Report",company:"Business",columns:["Party"],rows:[["😀"]]})).rejects.toThrow("REPORT_PDF_UNSUPPORTED_CHARACTER")});
it("retains the export row cap before font work",async()=>{await expect(exportPdf({title:"Report",company:"Business",columns:["Party"],rows:Array.from({length:REPORT_EXPORT_LIMIT+1},()=>["x"])})).rejects.toThrow("REPORT_EXPORT_LIMIT_EXCEEDED")});
