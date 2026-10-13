import {afterEach,describe,expect,it,vi} from "vitest";
import {isShareCancellation,preparePrintPdf} from "./share-print-file";
afterEach(()=>vi.unstubAllGlobals());
describe("safe PDF sharing",()=>{
 it("retains PDF type and sanitizes file paths",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("%PDF",{headers:{"content-type":"application/pdf"}})));const file=await preparePrintPdf("/authorized","INV/1");expect(file.name).toBe("INV_1.pdf");expect(file.type).toBe("application/pdf");expect(await file.text()).toBe("%PDF");});
 it.each([403,500])("rejects failed server responses %s",async status=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("secret error",{status})));await expect(preparePrintPdf("/authorized","1")).rejects.toThrow(status===403?"permission":"try again");});
 it("rejects HTML responses instead of sharing login/error pages",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("<html>login</html>",{headers:{"content-type":"text/html"}})));await expect(preparePrintPdf("/authorized","1")).rejects.toThrow("did not return a PDF");});
 it("treats user cancellation as cancellation only",()=>{expect(isShareCancellation(new DOMException("cancelled","AbortError"))).toBe(true);expect(isShareCancellation(new Error("network"))).toBe(false);});
});
