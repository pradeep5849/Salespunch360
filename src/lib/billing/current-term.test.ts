import {describe,expect,it} from "vitest";import {effectiveCurrentTerm} from "./current-term";
const d=(s:string)=>new Date(s);const row=(a:number,m:number,s:number,p:number,end:string,provider="UNCONFIGURED")=>({adminSeats:a,managerSeats:m,salesSeats:s,accountPackages:p,startsAt:d("2026-01-01"),endsAt:d(end),sourceOrder:{provider}});
describe("effectiveCurrentTerm",()=>{
 it("combines same-expiry historical Sales increments",()=>{const t=effectiveCurrentTerm([row(2,0,0,0,"2026-10-01"),row(0,1,1,0,"2026-10-01")]);expect(t).toMatchObject({adminSeats:2,managerSeats:1,salesSeats:1})});
 it("ignores older overlapping terms",()=>{const t=effectiveCurrentTerm([row(5,0,0,0,"2026-10-01"),row(1,1,2,0,"2027-04-01")]);expect(t).toMatchObject({adminSeats:1,managerSeats:1,salesSeats:2})});
 it("combines Account packages only in the authoritative latest term",()=>{const t=effectiveCurrentTerm([row(0,1,1,1,"2027-04-01","PLUS_COMBINED"),row(0,0,0,2,"2027-04-01","ACCOUNT_PACKAGE"),row(0,0,0,9,"2026-10-01","ACCOUNT_PACKAGE")]);expect(t?.accountPackages).toBe(3)});
 it("supports historical Account package quantity stored in adminSeats",()=>{const t=effectiveCurrentTerm([row(2,0,0,0,"2027-04-01","ACCOUNT_PACKAGE")]);expect(t).toMatchObject({adminSeats:0,managerSeats:0,salesSeats:0,accountPackages:2})});
});
