import {expect,it} from "vitest";
import {reportExportQuery} from "./queries";
it("preserves company intent and displayed default dates while dropping navigation state and blank selectors",()=>{
 const q=new URLSearchParams(reportExportQuery({scope:"all",page:"3",q:"search",customerId:"",branchId:"branch"},"2025-04-01","2026-01-10"));
 expect(Object.fromEntries(q)).toEqual({scope:"all",branchId:"branch",from:"2025-04-01",to:"2026-01-10"});
});
it("keeps lifetime reports free of period bounds",()=>{expect(reportExportQuery({from:"2020-01-01",asOf:"2021-01-01",projectId:"project",scope:"all"},"2025-04-01","2026-01-10",true)).toBe("projectId=project&scope=all")});

it("keeps the visible Cash/Bank account type on exports",()=>{expect(new URLSearchParams(reportExportQuery({accountType:"BANK",branchId:"branch"},"2026-10-01","2026-10-31")).get("accountType")).toBe("BANK")});

it("preserves category and item status in exports",()=>{
 const query=new URLSearchParams(reportExportQuery({categoryId:"UNCATEGORIZED",itemStatus:"INACTIVE"},"2026-10-01","2026-10-18"));
 expect(query.get("categoryId")).toBe("UNCATEGORIZED");expect(query.get("itemStatus")).toBe("INACTIVE");
});

it("preserves the selected bank in export requests",()=>{expect(new URLSearchParams(reportExportQuery({moneyAccountId:"bank"},"2026-10-01","2026-10-18")).get("moneyAccountId")).toBe("bank")});

it("preserves item searches literally in export URLs",()=>{const q=new URLSearchParams(reportExportQuery({itemSearch:"Pipe & Bolt",stockLevel:"LOW"},"2026-10-01","2026-10-18"));expect(q.get("itemSearch")).toBe("Pipe & Bolt");expect(q.get("stockLevel")).toBe("LOW")});

it("preserves the selected loan in export requests",()=>{expect(new URLSearchParams(reportExportQuery({loanId:"loan"},"2026-10-01","2026-10-18")).get("loanId")).toBe("loan")});
