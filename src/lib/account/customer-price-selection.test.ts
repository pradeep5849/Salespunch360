import {expect,it} from "vitest";
import {customerPriceForItem} from "./customer-price-selection";
import {itemPriceForDocument} from "./item-pricing";
const rows=[{id:"new",productId:"item",customerId:"party",rate:"80.00",effectiveFrom:"2026-10-01",effectiveTo:"2026-10-31"},{id:"old",productId:"item",customerId:"party",rate:"90.00",effectiveFrom:null,effectiveTo:null}];
it("selects the matching party and item within inclusive calendar dates",()=>{
 expect(customerPriceForItem(rows,"item","party","2026-10-01")?.id).toBe("new");
 expect(customerPriceForItem(rows,"item","party","2026-10-31")?.id).toBe("new");
 expect(customerPriceForItem(rows,"item","party","2026-11-01")?.id).toBe("old");
 expect(customerPriceForItem(rows,"item","other","2026-10-01")).toBeUndefined();
 expect(customerPriceForItem(rows,"other","party","2026-10-01")).toBeUndefined();
 expect(customerPriceForItem(rows,"item","","2026-10-01")).toBeUndefined();
});
it("keeps retail separate and converts the explicitly selected customer rate without reusing retail gross",()=>{
 const p={enteredSalePrice:"118",saleTaxMode:"INCLUSIVE",discountType:"FIXED",discountValue:"11.80",normalizedDiscountValue:"10"};
 expect(itemPriceForDocument("100","18",p,"INCLUSIVE").rate.toString()).toBe("118");
 const custom=itemPriceForDocument("100","18",p,"INCLUSIVE",false,"3","CUSTOMER","80");
 expect(custom.rate.toFixed(2)).toBe("94.40");expect(custom.discountValue.toFixed(2)).toBe("35.40");
 expect(itemPriceForDocument("100","18",null,"INCLUSIVE",false,"1","CUSTOMER","80").rate.toFixed(2)).toBe("94.40");
 expect(()=>itemPriceForDocument("100","18",p,"EXCLUSIVE",false,"1","CUSTOMER")).toThrow("CUSTOMER_PRICE_UNAVAILABLE");
});
