import {describe,it,expect} from "vitest";
import {commercialEditorPricing} from "./commercial-editor-pricing";
import {salePreviewTotals} from "./sale-preview-calculation";
const line={quantity:"3",rate:"",discountType:"",discountValue:"0",taxRate:"",cessRate:"0"};
const master={salePrice:"100",costPrice:"50",taxRate:"18",pricing:{saleTaxMode:"INCLUSIVE",purchaseTaxMode:"INCLUSIVE",enteredSalePrice:"118",enteredPurchasePrice:"59",discountType:"FIXED",discountValue:"11.8",normalizedDiscountValue:"10"}};
describe("commercial editor retained master pricing",()=>{
 it("previews inclusive purchase defaults without adding GST twice or applying sale discount",()=>{const resolved=commercialEditorPricing(line,master,true,"INCLUSIVE");expect(resolved).toMatchObject({rate:"59",taxRate:"18",discountType:"NONE",discountValue:"0"});expect(salePreviewTotals([resolved],"WITH")).toMatchObject({taxable:150,tax:27,total:177})});
 it("uses normalized exclusive purchase cost",()=>{const resolved=commercialEditorPricing(line,master,true,"EXCLUSIVE");expect(resolved.rate).toBe("50");expect(salePreviewTotals([resolved],"WITHOUT").total).toBe(177)});
 it("retains explicit quantity,rate,tax and billed-line discount",()=>{const resolved=commercialEditorPricing({...line,rate:"70",taxRate:"5",discountType:"FIXED",discountValue:"10"},master,true,"EXCLUSIVE");expect(resolved).toMatchObject({rate:"70",taxRate:"5",discountValue:"10"});expect(salePreviewTotals([resolved],"WITHOUT").total).toBe(210)});
 it("applies saved sale discount per unit but obeys Items discount OFF",()=>{expect(commercialEditorPricing(line,master,false,"EXCLUSIVE")).toMatchObject({rate:"100",discountType:"FIXED",discountValue:"30"});expect(commercialEditorPricing(line,master,false,"EXCLUSIVE",false)).toMatchObject({discountType:"NONE",discountValue:"0"})});
 it("keeps explicit zero distinct from omitted defaults",()=>{expect(commercialEditorPricing({...line,rate:"0",taxRate:"0"},master,true,"EXCLUSIVE")).toMatchObject({rate:"0",taxRate:"0"})});
 it("uses service purchase cost and custom input without an item master",()=>{expect(commercialEditorPricing(line,{estimatedCost:"12",taxRate:"0"},true,"EXCLUSIVE").rate).toBe("12");expect(commercialEditorPricing({...line,rate:"15",taxRate:"2"},undefined,true,"EXCLUSIVE").rate).toBe("15")});
});
