import {expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
const m=vi.hoisted(()=>({verify:vi.fn()}));
vi.mock("@/lib/account/utilities",()=>({verifyAccountData:m.verify}));
import Page from "./page";
it("renders server-authorized record review links and retains the read-only explanation",async()=>{
 m.verify.mockResolvedValue([{status:"ERROR",check:"Journal entries balance",affected:1,samples:["J1"],recommendation:"Review saved journal",records:[{label:"J1",href:"/workspace/account/accounting/journals/00000000-0000-4000-8000-000000000003"}],reviewHref:"/workspace/account/accounting/journals"}]);
 const html=renderToStaticMarkup(await Page());expect(html).toContain('aria-label="Affected record samples"');expect(html).toContain('href="/workspace/account/accounting/journals/00000000-0000-4000-8000-000000000003"');expect(html).toContain("Review J1");expect(html).toContain("No history is automatically rewritten.");expect(html).toContain("Review saved journal");
});
it("keeps incomplete results distinct and sample text is never turned into an arbitrary link",async()=>{
 m.verify.mockResolvedValue([{status:"ERROR",check:"Verification did not complete",affected:0,samples:["https://evil.invalid"],recommendation:"Retry within scan bounds",incomplete:true}]);
 const html=renderToStaticMarkup(await Page());expect(html).toContain("Scan incomplete");expect(html).not.toContain('href="https://evil.invalid"');expect(html).not.toContain("No issues detected in this check.");
});
it("shows unavailable independent stock reconciliation as NOT CHECKED without a clean result",async()=>{
 m.verify.mockResolvedValue([{status:"WARNING",coverage:"NOT_CHECKED",check:"Stock balances against an independent opening snapshot",affected:0,samples:[],recommendation:"No independent control balance is available. Review saved openings and physical stock."}]);
 const html=renderToStaticMarkup(await Page());expect(html).toContain("NOT CHECKED");expect(html).toContain("No independent control balance");expect(html).not.toContain("No issues detected in this check.");
});
