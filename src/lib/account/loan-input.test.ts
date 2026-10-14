import {describe,expect,it} from "vitest";
import {loanInput} from "./money";
const base={branchId:"00000000-0000-4000-8000-000000000001",moneyAccountId:"00000000-0000-4000-8000-000000000002",lender:"Bank",loanType:"TERM",principal:"100000",startDate:"2032-01-01",idempotencyKey:"loan-input-test"};
describe("loan identity and terms",()=>{
 it("preserves distinct names/numbers and trims optional descriptions",()=>{expect(loanInput.parse({...base,displayName:" Project A ",loanAccountNumber:" 123 ",description:" Work ",durationMonths:"60"})).toMatchObject({displayName:"Project A",loanAccountNumber:"123",description:"Work",durationMonths:60});});
 it("keeps historical/blank optional metadata absent",()=>{expect(loanInput.parse({...base,displayName:"",loanAccountNumber:"",description:"",durationMonths:""})).toMatchObject({displayName:undefined,loanAccountNumber:undefined,description:undefined,durationMonths:undefined});});
 it.each(["0","-1","1.5","1201","invalid"])("rejects invalid duration %s",durationMonths=>{expect(loanInput.safeParse({...base,durationMonths}).success).toBe(false);});
 it("rejects oversized identity and description",()=>{for(const [key,value] of [["displayName","a".repeat(241)],["loanAccountNumber","a".repeat(161)],["description","a".repeat(2001)]])expect(loanInput.safeParse({...base,[key]:value}).success).toBe(false);});
});
