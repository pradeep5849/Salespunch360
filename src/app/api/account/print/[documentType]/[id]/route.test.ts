import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({load:vi.fn(),html:vi.fn(),pdf:vi.fn()}));
vi.mock("@/lib/account/print",()=>({loadPrintDocument:mocks.load,renderAccountPrintHtml:mocks.html,renderAccountPrintPdf:mocks.pdf}));
import {GET} from "./route";
const params=(documentType:string)=>({params:Promise.resolve({documentType,id:"id"})});
beforeEach(()=>{vi.clearAllMocks();mocks.load.mockResolvedValue({paper:"A4",document:{number:"INV-1"}});mocks.html.mockReturnValue("<html>invoice</html>");mocks.pdf.mockResolvedValue(Buffer.from("%PDF"))});
describe("account print route",()=>{
 it("serves private inline HTML",async()=>{const response=await GET(new Request("https://example.test/api/account/print/SALES_INVOICE/id"),params("sales_invoice"));expect(mocks.load).toHaveBeenCalledWith("SALES_INVOICE","id");expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");expect(response.headers.get("content-disposition")).toBe("inline");expect(response.headers.get("cache-control")).toBe("private, no-store")});
 it("serves a named PDF attachment",async()=>{const response=await GET(new Request("https://example.test/api/account/print/SALES_INVOICE/id?format=pdf"),params("SALES_INVOICE"));expect(response.headers.get("content-type")).toBe("application/pdf");expect(response.headers.get("content-disposition")).toBe('attachment; filename="INV-1.pdf"');expect(await response.text()).toBe("%PDF")});
 it("returns 404 for unsupported/not-found without swallowing authorization errors",async()=>{mocks.load.mockRejectedValueOnce(new Error("PRINT_DOCUMENT_NOT_FOUND"));const missing=await GET(new Request("https://example.test/api/account/print/X/id"),params("X"));expect(missing.status).toBe(404);mocks.load.mockRejectedValueOnce(new Error("Not authorized"));await expect(GET(new Request("https://example.test/api/account/print/X/id"),params("X"))).rejects.toThrow("Not authorized")});
});
