import {describe,expect,it} from "vitest";
import {DEFAULT_TRANSACTION_PREFERENCES,normalizeTransactionPreferences,PREFIX_TYPES,TRANSACTION_SETTING_SECTIONS} from "./transaction-settings";

describe("transaction settings contracts",()=>{
  it("keeps the exact section order and safe prefix series",()=>{
    expect(TRANSACTION_SETTING_SECTIONS).toEqual(["Transaction Header","Items Table","Taxes, Discount & Total","More Transaction Features","GST","Transaction Prefixes"]);
    expect(PREFIX_TYPES.map(([key])=>key)).toEqual(["SALES_INVOICE","CREDIT_NOTE","SALES_ORDER","PURCHASE_ORDER","ESTIMATE","PROFORMA_INVOICE","DELIVERY_CHALLAN","CUSTOMER_RECEIPT"]);
  });
  it("normalizes additive preferences without changing legacy defaults",()=>{
    expect(normalizeTransactionPreferences({roundOff:true}).roundOff).toBe(true);
    expect(normalizeTransactionPreferences({roundOff:true}).linkPayments).toBe(DEFAULT_TRANSACTION_PREFERENCES.linkPayments);
    expect(()=>normalizeTransactionPreferences({roundingStep:0})).toThrow();
  });
});
