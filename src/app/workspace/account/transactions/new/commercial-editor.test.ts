import{describe,expect,it}from"vitest";import{availableCommercialDocumentTypes,changeCommercialLineType,commercialLinePayload,newCommercialLine,resolveInitialCommercialDocumentType}from"./commercial-editor";
describe("commercial editor module types",()=>{
 it("starts with a purchase type for a purchase-only company",()=>expect(availableCommercialDocumentTypes(["PURCHASES","PURCHASE_BILLS"])[0]).toBe("PURCHASE_BILL"));
 it("starts with a sales type for a sales-only company",()=>expect(availableCommercialDocumentTypes(["SALES"])[0]).toBe("SALES_INVOICE"));
 it("has no create type when both parents are disabled",()=>expect(availableCommercialDocumentTypes(["CREDIT_NOTE","DEBIT_NOTE"])).toEqual([]));
 it("requires parent and child module chains",()=>expect(availableCommercialDocumentTypes(["SALES","CREDIT_NOTE","PURCHASES","DEBIT_NOTE"])).toEqual(["SALES_INVOICE","CREDIT_NOTE","DEBIT_NOTE"]));
 it.each([["SALES_INVOICE",["SALES"]],["CREDIT_NOTE",["SALES","CREDIT_NOTE"]],["PURCHASE_BILL",["PURCHASES","PURCHASE_BILLS"]]] as const)("preselects allowed %s",(requested,modules)=>{const available=availableCommercialDocumentTypes([...modules]);expect(resolveInitialCommercialDocumentType(available,requested)).toBe(requested)});
 it("falls back for invalid or disabled requested types",()=>{const available=availableCommercialDocumentTypes(["SALES"]);expect(resolveInitialCommercialDocumentType(available,"NOT_REAL")).toBe("SALES_INVOICE");expect(resolveInitialCommercialDocumentType(available,"DELIVERY_CHALLAN")).toBe("SALES_INVOICE")});
 it("omits blank master-backed tax but preserves explicit zero",()=>{expect(commercialLinePayload(newCommercialLine("PRODUCT")).taxRate).toBeUndefined();expect(commercialLinePayload({...newCommercialLine("PRODUCT"),taxRate:"0"}).taxRate).toBe("0")});
 it("keeps CUSTOM at a safe explicit zero",()=>expect(commercialLinePayload(newCommercialLine()).taxRate).toBe("0"));
 it("clears stale custom tax and source when changing to a master-backed line",()=>{const changed=changeCommercialLineType({...newCommercialLine(),taxRate:"12",sourceId:"old-product"},"SERVICE");expect(changed.taxRate).toBe("");expect(changed.sourceId).toBe("")});
});
