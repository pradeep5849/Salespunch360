import {describe,expect,it} from "vitest";
import {attachmentDisplayName} from "./attachment-name";
describe("A049-F03 attachment display metadata",()=>{
 it.each(["../../receipt.pdf","/absolute/path/receipt.pdf","C:\\private\\receipt.pdf","receipt.pdf"])("strips paths from %s",name=>expect(attachmentDisplayName(name)).toBe("receipt.pdf"));
 it("removes control characters and bounds metadata",()=>{expect(attachmentDisplayName("a\u0000\r\n.pdf")).toBe("a.pdf");expect(attachmentDisplayName("x".repeat(250))).toHaveLength(240)});
 it.each(["","../","..","."])("supplies a safe fallback for %s",name=>expect(attachmentDisplayName(name)).toBe("attachment"));
});
