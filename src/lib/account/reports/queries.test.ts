import {expect,it} from "vitest";
import {reportExportQuery} from "./queries";
it("preserves company intent and displayed default dates while dropping navigation state and blank selectors",()=>{
 const q=new URLSearchParams(reportExportQuery({scope:"all",page:"3",q:"search",customerId:"",branchId:"branch"},"2025-04-01","2026-01-10"));
 expect(Object.fromEntries(q)).toEqual({scope:"all",branchId:"branch",from:"2025-04-01",to:"2026-01-10"});
});
it("keeps lifetime reports free of period bounds",()=>{expect(reportExportQuery({from:"2020-01-01",asOf:"2021-01-01",projectId:"project",scope:"all"},"2025-04-01","2026-01-10",true)).toBe("projectId=project&scope=all")});
