import{describe,expect,it}from"vitest";import{availableCommercialDocumentTypes}from"./commercial-editor";
describe("commercial editor module types",()=>{
 it("starts with a purchase type for a purchase-only company",()=>expect(availableCommercialDocumentTypes(["PURCHASES","PURCHASE_BILLS"])[0]).toBe("PURCHASE_BILL"));
 it("starts with a sales type for a sales-only company",()=>expect(availableCommercialDocumentTypes(["SALES"])[0]).toBe("SALES_INVOICE"));
 it("has no create type when both parents are disabled",()=>expect(availableCommercialDocumentTypes(["CREDIT_NOTE","DEBIT_NOTE"])).toEqual([]));
 it("requires parent and child module chains",()=>expect(availableCommercialDocumentTypes(["SALES","CREDIT_NOTE","PURCHASES","DEBIT_NOTE"])).toEqual(["SALES_INVOICE","CREDIT_NOTE","DEBIT_NOTE"]));
});
