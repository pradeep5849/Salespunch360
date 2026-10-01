import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {TRANSACTION_FILTERS} from "../account-mobile-home";

describe("account home contexts",()=>{
  it("exposes the exact transaction filter labels in their requested order",()=>{
    expect(TRANSACTION_FILTERS.map(x=>x.label)).toEqual(["Sale","Sale Order","Credit Note","Purchase","Purchase Order","Debit Note","Payment-In","Payment-Out","Estimate","Proforma Invoice","Expense","Delivery Challan","Party To Party [Rcvd]","Party To Party [Paid]","Sale FA","Purchase FA","Sale [Cancelled]","Job work out (Challan)","Purchase (Job work)","Sale [Repeating]"]);
  });
  it("keeps transaction and party More Options independently selected",()=>{
    const source=readFileSync("src/components/account/account-mobile-home.tsx","utf8");
    expect(source).toContain('tab==="transactions"?MORE_TXN:MORE_PARTY');
    expect(source).not.toContain('label:"Recycle Bin"');
    expect(source).toContain('update({tab:"parties",q:null,types:null})');
  });
});
