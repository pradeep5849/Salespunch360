import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {DisplayPreferencesProvider} from "@/components/account/display-preferences";
import {resolveDisplayPreferences} from "@/lib/account/display-preferences";
const m=vi.hoisted(()=>({year:vi.fn(),dashboard:vi.fn(),permission:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({requirePermission:m.permission}));
vi.mock("@/lib/db",()=>({db:{financialYear:{findFirst:m.year},accountSettings:{findUnique:vi.fn(async()=>null)}}}));
vi.mock("@/lib/account/branch-context",()=>({resolveAccountBranchContext:vi.fn(async()=>({context:{mode:"COMPANY"}}))}));
vi.mock("@/lib/account/branch-dashboard",()=>({accountBranchDashboard:m.dashboard}));
vi.mock("@/lib/account/modules",()=>({enabledModulesForCompany:vi.fn(async()=>[])}));
vi.mock("@/lib/account/dashboard-links",()=>({dashboardLinks:vi.fn(()=>({})),signedTrendPercent:vi.fn(()=>0)}));
import Page from "./page";
beforeEach(()=>{
 vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
 m.permission.mockResolvedValue({id:"actor",companyId:"company-a",accountRole:"ACCOUNT_ADMIN"});m.year.mockResolvedValue(null);
 m.dashboard.mockResolvedValue({projectOnly:true,projects:0,projectValue:"0"});
});
afterEach(()=>vi.useRealTimers());
async function html(dateFormat:"DD/MM/YYYY"|"MM/DD/YYYY"|"YYYY-MM-DD"){
 return renderToStaticMarkup(<DisplayPreferencesProvider values={resolveDisplayPreferences({dateFormat})}>{await Page({searchParams:Promise.resolve({})})}</DisplayPreferencesProvider>);
}
describe("A090 dashboard financial-year date preferences",()=>{
 it.each([["DD/MM/YYYY","01/04/2026"],["MM/DD/YYYY","04/01/2026"],["YYYY-MM-DD","2026-04-01"]] as const)("formats the unnamed year using %s",async(format,expected)=>{
  const result=await html(format);expect(result).toContain(`Authorized Projects · ${expected}`);expect(result).not.toContain("[object Object]");
  expect(m.year).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:"company-a",status:"OPEN"}}));
 });
 it("preserves the company's named financial year without treating its name as a date",async()=>{
  m.year.mockResolvedValue({name:"FY 2026–2027",startDate:new Date("2026-04-01")});
  expect(await html("MM/DD/YYYY")).toContain("Authorized Projects · FY 2026–2027");
 });
 it("uses the same formatter in the general dashboard header",async()=>{
  m.dashboard.mockResolvedValue({projectOnly:false,cashBank:"0",cash:"0",bank:"0"});
  expect(await html("YYYY-MM-DD")).toContain("Current Financial Year · 2026-04-01");
 });
 it("uses the preceding April before the financial year boundary",async()=>{
  vi.setSystemTime(new Date("2026-03-31T23:00:00Z"));expect(await html("YYYY-MM-DD")).toContain("Authorized Projects · 2025-04-01");
 });
});
