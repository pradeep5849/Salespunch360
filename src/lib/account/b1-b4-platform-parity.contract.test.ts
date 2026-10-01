import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("B1-B4 web and Android parity",()=>{
  it("shares every settings section and launcher label",()=>{
    const web=(readFileSync("src/lib/account/transaction-settings.ts","utf8")+readFileSync("src/components/account/account-mobile-home.tsx","utf8")).toUpperCase();
    const android=(readFileSync("android/app/src/main/java/com/salespunch360/mobile/ui/account/admin/AccountAdministrationScreen.kt","utf8")+readFileSync("android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt","utf8")).toUpperCase();
    for(const label of ["TRANSACTION HEADER","ITEMS TABLE","TAXES, DISCOUNT & TOTAL","MORE TRANSACTION FEATURES","GST","TRANSACTION PREFIXES","PAYMENT-IN","SALE RETURN","MOBILE POS","PURCHASE RETURN","P2P TRANSFER"]) expect(android).toContain(label);
    for(const label of ["PAYMENT-IN","SALE RETURN","MOBILE POS","PURCHASE RETURN","P2P TRANSFER"]) expect(web).toContain(label);
    expect(android).toContain("COMING SOON");
  });
});
