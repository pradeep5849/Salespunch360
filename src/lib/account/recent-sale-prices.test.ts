import {describe,it,expect,vi,beforeEach} from "vitest";
const query=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/db",()=>({db:{$queryRaw:query}}));
import {recentSalePrices} from "./recent-sale-prices";
beforeEach(()=>{query.mockReset();query.mockResolvedValue([])});
describe("recent invoice prices",()=>{
 it("does not query when switched off or no authorized branches exist",async()=>{
  expect(await recentSalePrices({companyId:"company"},false)).toEqual([]);
  expect(await recentSalePrices({companyId:"company",branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},true)).toEqual([]);
  expect(query).not.toHaveBeenCalled();
 });
 it("limits each item's history to five posted invoices in the company and permitted branches",async()=>{
  await recentSalePrices({companyId:"company",branchAccessScope:"SELECTED_BRANCHES",branchIds:["branch-1"]},true);
  const sql=query.mock.calls[0][0];expect(sql.values).toEqual(["company","branch-1"]);expect(sql.sql).toContain("position<=5");expect(sql.sql).toContain("d.status='POSTED'");expect(sql.sql).toContain('d."companyId"=l."companyId"');
 });
});
