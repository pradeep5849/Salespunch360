import {describe,expect,it} from "vitest";
import {leadVisitCount,pendingVisitWhere} from "./policy";

describe("pending check-in visibility",()=>{
 it("limits Sales to their own pending NEW visits",()=>expect(pendingVisitWhere({id:"sales",companyId:"one",role:"SALES"})).toMatchObject({companyId:"one",visitType:"NEW",leadId:null,userId:"sales"}));
 it("gives managers their own and direct-report Sales only",()=>expect(pendingVisitWhere({id:"manager",companyId:"one",role:"MANAGER"})).toMatchObject({companyId:"one",AND:[{OR:[{userId:"manager"},{user:{role:"SALES",managerId:"manager"}}]}]}));
 it("gives admins company scope without cross-company leakage",()=>{const where=pendingVisitWhere({id:"admin",companyId:"one",role:"COMPANY_ADMIN"});expect(where.companyId).toBe("one");expect(where).not.toHaveProperty("userId")});
 it("defines pending as no-phone, unlinked NEW visits",()=>expect(pendingVisitWhere({id:"sales",companyId:"one",role:"SALES"})).toMatchObject({visitType:"NEW",leadId:null,OR:[{contactPhone:null},{contactPhone:""}]}));
});

describe("lead-specific visit count",()=>{
 it("counts a manual lead as zero",()=>expect(leadVisitCount({sourceVisitId:null,visits:[]})).toBe(0));
 it("counts a linked originating visit once",()=>expect(leadVisitCount({sourceVisitId:"origin",visits:[{id:"origin"}]})).toBe(1));
 it("counts an unlinked source visit",()=>expect(leadVisitCount({sourceVisitId:"origin",visits:[]})).toBe(1));
 it("does not double-count the source and increments repeats",()=>expect(leadVisitCount({sourceVisitId:"origin",visits:[{id:"origin"},{id:"repeat"}]})).toBe(2));
 it("does not count unrelated customer visits",()=>expect(leadVisitCount({sourceVisitId:"origin",visits:[{id:"origin"},{id:"this-lead-repeat"}]})).toBe(2));
});
