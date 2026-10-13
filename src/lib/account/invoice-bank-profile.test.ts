import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({bank:vi.fn()}));vi.mock("@/lib/db",()=>({db:{moneyAccount:{findFirst:m.bank}}}));
import {invoiceBankProfile} from "./invoice-bank-profile";
const id="00000000-0000-4000-8000-000000000001";
describe("scoped invoice bank instructions",()=>{
 beforeEach(()=>vi.resetAllMocks());
 it("retains legacy global profile only when no bank was selected",async()=>{expect(await invoiceBankProfile("company","branch","")).toBeNull();expect(m.bank).not.toHaveBeenCalled();});
 it.each([[false,false],[true,false],[false,true],[true,true]])("honors independent bank and QR opt-ins %s/%s",async(bank,qr)=>{m.bank.mockResolvedValue({name:"Bank account",bankName:"Bank",accountHolderName:"Holder",bankBranchName:"Main",accountNumberMasked:"****1234",ifsc:"SBIN0001234",upiId:"holder@bank",printBankDetails:bank,printUpiQr:qr});const profile=await invoiceBankProfile("company","branch",id);expect(profile?.bankDetails).toBe(bank?"Bank · Holder · Main · ****1234 · SBIN0001234":null);expect(profile?.upiId).toBe(qr?"holder@bank":undefined);expect(profile?.showQr).toBe(qr);expect(m.bank.mock.calls[0][0].where).toEqual({id,companyId:"company",type:"BANK",isActive:true,OR:[{branchId:null},{branchId:"branch"}]});});
 it("fails closed for inactive, foreign-company/branch or malformed selected accounts",async()=>{m.bank.mockResolvedValue(null);expect(await invoiceBankProfile("company","branch",id)).toEqual({bankDetails:null,showQr:false});m.bank.mockClear();expect(await invoiceBankProfile("company","branch","invalid")).toEqual({bankDetails:null,showQr:false});expect(m.bank).not.toHaveBeenCalled();});
});
