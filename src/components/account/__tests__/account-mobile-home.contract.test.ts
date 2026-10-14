import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it,vi} from "vitest";
import {readFileSync} from "node:fs";
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()}),usePathname:()=>"/workspace/account",useSearchParams:()=>new URLSearchParams("q=old&types=SALES_INVOICE")}));
import {AccountMobileHome,ADD_GROUPS,TRANSACTION_FILTERS} from "../account-mobile-home";

describe("account home contexts",()=>{
  it("exposes the exact transaction filter labels in their requested order",()=>{
    expect(TRANSACTION_FILTERS.map(x=>x.label)).toEqual(["Sale","Sale Order","Credit Note","Purchase","Purchase Order","Debit Note","Payment-In","Payment-Out","Estimate","Proforma Invoice","Expense","Delivery Challan","Party To Party [Rcvd]","Party To Party [Paid]","Sale FA","Purchase FA","Sale [Cancelled]","Job work out (Challan)","Purchase (Job work)","Sale [Repeating]"]);
  });
  it("uses source destinations and hides unsupported print and estimate balances",()=>{
    const html=renderToStaticMarkup(createElement(AccountMobileHome,{tab:"transactions",transactions:[{id:"expense",sourceKind:"EXPENSE",type:"EXPENSE",documentNumber:"E1",issueDate:"2026-10-13",status:"DRAFT",partyName:"Office",grandTotal:"90",balanceDue:"0",showBalance:false,detailHref:"/workspace/account/expenses/expense",printType:null}],parties:[],q:"",selectedTypes:[]}));
    expect(html).toContain('href="/workspace/account/expenses/expense"');expect(html).not.toContain('/api/account/print/EXPENSE');expect(html).not.toContain('aria-label="Share"');expect(html).not.toContain('<small>Balance</small>');
  });
  it("keeps search/filter and the visible floating sale action contracts",()=>{
    const source=readFileSync("src/components/account/account-mobile-home.tsx","utf8"),css=readFileSync("src/app/globals.css","utf8");
    expect(source).toContain('className="account-home-search"');
    expect(source).toMatch(/placeholder=\{\s*tab\s*===\s*"transactions"\s*\?\s*"Search party or document number"/);
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
    expect(source).toMatch(/tab\s*===\s*"transactions"\s*\?\s*MORE_TXN\s*:\s*MORE_PARTY/);
    expect(source).not.toMatch(/label:\s*"Recycle Bin"/);
    const html=renderToStaticMarkup(createElement(AccountMobileHome,{tab:"transactions",transactions:[],parties:[],q:"old",selectedTypes:["SALES_INVOICE"],searchScope:{branchId:"branch"}}));
    const href=html.match(/href="([^"]+)"[^>]*>Party Details<\/a>/)?.[1];expect(href).toBeDefined();
    const target=new URL(href!.replaceAll("&amp;","&"),"https://example.test");expect(target.searchParams.get("tab")).toBe("parties");expect(target.searchParams.get("branchId")).toBe("branch");expect(target.searchParams.has("q")).toBe(false);expect(target.searchParams.has("types")).toBe(false);
  });
});
