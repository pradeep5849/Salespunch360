import {describe,expect,it} from "vitest";
import {bankIfsc,moneyBankMetadata,hasBankMetadata} from "./money-bank-metadata";
describe("bank metadata validation",()=>{
 it("defaults per-account invoice opt-ins OFF without inventing bank details",()=>{const value=moneyBankMetadata.parse({});expect(value).toEqual({printBankDetails:false,printUpiQr:false});expect(hasBankMetadata(value)).toBe(false);});
 it.each([[false,false],[true,false],[false,true],[true,true]])("preserves independent bank/QR preferences %s/%s",(bank,qr)=>expect(moneyBankMetadata.parse({printBankDetails:String(bank),printUpiQr:String(qr),upiId:"owner@bank",accountHolderName:" Owner ",bankBranchName:" Branch "})).toMatchObject({printBankDetails:bank,printUpiQr:qr,accountHolderName:"Owner",bankBranchName:"Branch"}));
 it("accepts valid optional IFSC/UPI and rejects malformed values",()=>{expect(bankIfsc.parse("SBIN0001234")).toBe("SBIN0001234");expect(bankIfsc.parse("")).toBeUndefined();for(const value of ["BANK1234","SBIN1001234","invalid"])expect(bankIfsc.safeParse(value).success).toBe(false);for(const value of ["missingat","a@bank","valid@bank?amount=99"])expect(moneyBankMetadata.safeParse({upiId:value}).success).toBe(false);});
 it("rejects arbitrary switch values and oversized holder metadata",()=>{expect(moneyBankMetadata.safeParse({printUpiQr:"anything"}).success).toBe(false);expect(moneyBankMetadata.safeParse({accountHolderName:"a".repeat(161)}).success).toBe(false);});
});
