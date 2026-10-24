import {beforeEach,expect,it,vi} from "vitest";
import type {ProjectActor} from "@/lib/account/projects";
const m=vi.hoisted(()=>({transaction:vi.fn(),branch:vi.fn(),customer:vi.fn(),balance:vi.fn(),modules:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{$transaction:m.transaction}}));
vi.mock("@/lib/account/party-balance",()=>({currentPartyBalanceForActor:m.balance}));
vi.mock("@/lib/account/modules",()=>({requireAccountModules:m.modules}));
import {quotationPartyBalanceForActor} from "./party-balance";
const branch="22222222-2222-4222-8222-222222222222",party="33333333-3333-4333-8333-333333333333";
const actor={companyId:"company",isActive:true,accountAccessActive:true,role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",branchAccessScope:"SELECTED_BRANCHES",branchIds:[branch]} as ProjectActor;
const tx={branch:{findFirst:m.branch},customer:{findFirst:m.customer}};
beforeEach(()=>{vi.clearAllMocks();m.transaction.mockImplementation(async fn=>fn(tx));m.branch.mockResolvedValue({id:branch});m.customer.mockResolvedValue({id:party});m.balance.mockResolvedValue("-90071992547409.91");m.modules.mockResolvedValue(undefined)});
it("uses the existing exact posted-party balance in the same authorized snapshot",async()=>{
 expect(await quotationPartyBalanceForActor(actor,{partyId:party,branchId:branch})).toEqual({partyId:party,branchId:branch,balance:"-90071992547409.91"});
 expect(m.customer).toHaveBeenCalledWith({where:{id:party,companyId:"company",branchId:branch,isAccountCustomer:true},select:{id:true}});
 expect(m.balance).toHaveBeenCalledWith(actor,party,true,tx);expect(m.transaction).toHaveBeenCalledWith(expect.any(Function),{isolationLevel:"RepeatableRead"});
});
it("rejects unassigned branches before any company-data read",async()=>{
 await expect(quotationPartyBalanceForActor({...actor,branchIds:[]},{partyId:party,branchId:branch})).rejects.toThrow();expect(m.transaction).not.toHaveBeenCalled();expect(m.balance).not.toHaveBeenCalled();
});
it("does not reveal balances for absent/foreign/mismatched customer identities",async()=>{
 m.customer.mockResolvedValue(null);await expect(quotationPartyBalanceForActor(actor,{partyId:party,branchId:branch})).rejects.toThrow();expect(m.balance).not.toHaveBeenCalled();
});
it("requires global customer, ledger and quotation permission, not merely knowledge of an id",async()=>{
 await expect(quotationPartyBalanceForActor({...actor,accountRole:"PROJECT_MANAGER"},{partyId:party,branchId:branch})).rejects.toThrow();expect(m.transaction).not.toHaveBeenCalled();
});
it("validates ids and rejects supplied company context rather than trusting it",async()=>{
 await expect(quotationPartyBalanceForActor(actor,{partyId:"bad",branchId:branch})).rejects.toThrow();await expect(quotationPartyBalanceForActor(actor,{partyId:party,branchId:branch,companyId:"foreign"})).rejects.toThrow();expect(m.transaction).not.toHaveBeenCalled();
});
it("does not replace backend failures with a fabricated zero balance",async()=>{
 m.balance.mockRejectedValue(new Error("database unavailable"));await expect(quotationPartyBalanceForActor(actor,{partyId:party,branchId:branch})).rejects.toThrow("database unavailable");
});

it("checks branch company membership independently before resolving the customer",async()=>{
 m.branch.mockResolvedValue(null);await expect(quotationPartyBalanceForActor(actor,{partyId:party,branchId:branch})).rejects.toThrow();expect(m.branch).toHaveBeenCalledWith({where:{id:branch,companyId:"company"},select:{id:true}});expect(m.customer).not.toHaveBeenCalled();expect(m.balance).not.toHaveBeenCalled();
});
it("does not query balances when the quotation module is disabled",async()=>{
 m.modules.mockRejectedValue(new Error("MODULE_DISABLED"));await expect(quotationPartyBalanceForActor(actor,{partyId:party,branchId:branch})).rejects.toThrow("MODULE_DISABLED");expect(m.transaction).not.toHaveBeenCalled();
});
it("allows data-entry customer balance reads without granting stock or cost access",async()=>{
 const entry={...actor,accountRole:"DATA_ENTRY"} as ProjectActor;
 expect(await quotationPartyBalanceForActor(entry,{partyId:party,branchId:branch})).toEqual({partyId:party,branchId:branch,balance:"-90071992547409.91"});expect(m.balance).toHaveBeenCalledWith(entry,party,true,tx);
});
