import {describe,expect,it} from "vitest";
import {mobileUnexpected} from "./http";
describe("actionable mobile loan errors",()=>{
 it.each([
  ["PRINCIPAL_EXCEEDS_OUTSTANDING","Principal paid cannot exceed"],
  ["INVALID_LOAN","Select an active loan"],
  ["INTEREST_LEDGER_MISSING","Set up the general expense ledger"],
 ])("returns controlled actionable feedback for %s",async(code,message)=>{const response=mobileUnexpected("MOBILE_LOAN_PAYMENT",new Error(code));expect(response.status).toBe(400);expect(await response.json()).toMatchObject({error:code,message:expect.stringContaining(message)});expect(response.headers.get("cache-control")).toBe("no-store");});
});
