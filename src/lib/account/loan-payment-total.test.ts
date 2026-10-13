import {describe,expect,it} from "vitest";
import {loanPaymentTotal} from "./loan-payment-total";
describe("exact EMI total",()=>{it("adds principal, interest and charges without binary rounding",()=>{expect(loanPaymentTotal("2000","550","0")).toBe("2550.00");expect(loanPaymentTotal("0.10","0.20","0.01")).toBe("0.31");expect(loanPaymentTotal("9999999999999999.99","0.01")).toBe("10000000000000000.00");});it.each(["-1","1.234","1e5","bad"])("rejects invalid amount %s",value=>expect(loanPaymentTotal(value,"0","0")).toBeNull());});
