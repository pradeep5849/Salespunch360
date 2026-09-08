import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const source=readFileSync(new URL("./page.tsx",import.meta.url),"utf8");
describe("expense approval authorization presentation",()=>{
 it("keeps the report available through reportActor",()=>expect(source).toContain("expenseReport(raw)"));
 it("shows approval controls only to the Primary Admin",()=>{expect(source).toContain('r.actor.salesRole==="PRIMARY_ADMIN"&&row.status');expect(source).not.toContain('r.actor.salesRole==="ADMIN"')});
});
