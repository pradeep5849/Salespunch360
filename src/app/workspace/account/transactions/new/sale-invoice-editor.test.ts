import {describe,expect,it} from "vitest";
import {saleInvoicePreview} from "./sale-invoice-editor";
import {resolveInitialCommercialDocumentType} from "./commercial-editor";

describe("B5 direct sale contract",()=>{
 it("previews the canonical branch NumberingSeries without allocating it",()=>expect(saleInvoicePreview([{branchId:"b",prefix:"INV-",suffix:"",padding:6,nextSequence:42}],"b")).toBe("INV-000042"));
 it("uses at least two digits while respecting configured padding",()=>{expect(saleInvoicePreview([{branchId:"b",prefix:"",suffix:"",padding:1,nextSequence:1}],"b")).toBe("01");expect(saleInvoicePreview([{branchId:"b",prefix:"",suffix:"",padding:1,nextSequence:10}],"b")).toBe("10")});
 it("shows a fresh non-allocating preview when a series has not been persisted",()=>expect(saleInvoicePreview([],"b")).toBe("01"));
 it("leaves all non-sale commercial types on the generic editor resolver",()=>expect(resolveInitialCommercialDocumentType(["PURCHASE_BILL","SALES_ORDER"],"PURCHASE_BILL")).toBe("PURCHASE_BILL"));
});
