import {expect,it} from "vitest";
import {verificationActions} from "./verification-actions";
import type {VerificationResult} from "./utilities";
const row:VerificationResult={status:"ERROR",check:"Journal entries balance",affected:10,samples:["J1"],recommendation:"Review saved journal"};
const id="00000000-0000-4000-8000-000000000003";
it("adds bounded review links from server-selected record IDs and retains recommendations",()=>{
 const result=verificationActions(row,Array.from({length:9},(_,i)=>({id,label:`J${i}`,kind:"journal" as const})));
 expect(result.records).toHaveLength(5);expect(result.records?.[0]).toEqual({label:"J0",href:`/workspace/account/accounting/journals/${id}`});expect(result.recommendation).toBe(row.recommendation);
});
it("does not make raw samples, malformed identifiers or arbitrary URLs navigable",()=>{
 const result=verificationActions({...row,samples:["https://evil.invalid"]},[{id:"../settings",label:"Bad",kind:"journal"},{id:"https://evil.invalid",label:"Bad",kind:"document"}]);
 expect(result.records).toBeUndefined();expect(result.reviewHref).toBe("/workspace/account/accounting/journals");
});
it("uses existing document/project/asset read pages and avoids edit or mutation URLs",()=>{
 for(const kind of ["document","project","asset"] as const){const result=verificationActions(row,[{id,label:"Affected",kind}]);expect(result.records?.[0].href).toMatch(new RegExp(`/workspace/account/${kind==="document"?"transactions":kind==="project"?"projects":"assets"}/${id}$`));}
});
it("does not recommend repairs or record navigation for passing/incomplete checks",()=>{
 for(const check of [{...row,status:"PASS" as const},{...row,incomplete:true}])expect(verificationActions(check,[{id,label:"J1",kind:"journal"}])).toEqual(check);
});
it("provides review workspaces for system mapping and stock issues without fabricating record IDs",()=>{
 expect(verificationActions({...row,check:"Warehouse transfer legs reconcile"}).reviewHref).toBe("/workspace/account/inventory/transfers");expect(verificationActions({...row,check:"System ledgers are unique"}).reviewHref).toBe("/workspace/account/accounting/accounts");expect(verificationActions({...row,check:"Unknown new check"}).reviewHref).toBeUndefined();
});
