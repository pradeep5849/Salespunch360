import {describe,expect,it} from "vitest";
import {saleInvoicePreview} from "./sale-invoice-editor";
import {resolveInitialCommercialDocumentType} from "./commercial-editor";

describe("B5 direct sale contract",()=>{
 it("previews the canonical branch NumberingSeries without allocating it",()=>expect(saleInvoicePreview([{branchId:"b",prefix:"INV-",suffix:"",padding:6,nextSequence:42}],"b")).toBe("INV-000042"));
 it("leaves all non-sale commercial types on the generic editor resolver",()=>expect(resolveInitialCommercialDocumentType(["PURCHASE_BILL","SALES_ORDER"],"PURCHASE_BILL")).toBe("PURCHASE_BILL"));
});
