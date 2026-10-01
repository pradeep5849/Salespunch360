import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {ADD_GROUPS,TRANSACTION_FILTERS} from "../account-mobile-home";

describe("account home contexts",()=>{
  it("exposes the exact transaction filter labels in their requested order",()=>{
    expect(TRANSACTION_FILTERS.map(x=>x.label)).toEqual(["Sale","Sale Order","Credit Note","Purchase","Purchase Order","Debit Note","Payment-In","Payment-Out","Estimate","Proforma Invoice","Expense","Delivery Challan","Party To Party [Rcvd]","Party To Party [Paid]","Sale FA","Purchase FA","Sale [Cancelled]","Job work out (Challan)","Purchase (Job work)","Sale [Repeating]"]);
  });
  it("keeps search/filter and the visible floating sale action contracts",()=>{
    const source=readFileSync("src/components/account/account-mobile-home.tsx","utf8"),css=readFileSync("src/app/globals.css","utf8");
    expect(source).toContain('className="account-home-search"');
    expect(source).toContain('placeholder={tab==="transactions"?"Search party or document number"');
    expect(source).toContain('"+ Add New Sale"');
    expect(css).toContain("padding-left:42px!important");
    expect(css).toContain("color:#fff!important");
    expect(css).toContain("pointer-events:none");
  });
  it("exposes the exact grouped launcher order and disabled Mobile POS",()=>{
    expect(ADD_GROUPS.map(group=>[group.title,group.actions.map(action=>action.label)])).toEqual([
      ["Sale transactions",["Payment-In","Sale Return","Delivery Challan","Estimate / Quotation","Proforma Invoice","Sale Order","Sale Invoice","Mobile POS"]],
      ["Purchase transactions",["Purchase","Payment-Out","Purchase Return","Purchase Order"]],
      ["Other transactions",["Expenses","P2P Transfer"]],
    ]);
    expect(ADD_GROUPS[0].actions.at(-1)).toMatchObject({label:"Mobile POS",disabled:true});
  });
  it("keeps transaction and party More Options independently selected",()=>{
    const source=readFileSync("src/components/account/account-mobile-home.tsx","utf8");
    expect(source).toContain('tab==="transactions"?MORE_TXN:MORE_PARTY');
    expect(source).not.toContain('label:"Recycle Bin"');
    expect(source).toContain('update({tab:"parties",q:null,types:null})');
  });
});
