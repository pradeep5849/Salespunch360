import {beforeEach,describe,expect,it,vi} from "vitest";
import type {Prisma} from "@prisma/client";
const sync=vi.hoisted(()=>vi.fn());
vi.mock("./telecaller",()=>({syncTelecallerSubscriptionToSalesTerm:sync}));
import {syncUnifiedTelecallerTargetInTx} from "./unified-telecaller-target";
const marker=vi.fn(),term=vi.fn(),raw=vi.fn(),execute=vi.fn();
const client={billingAuditEvent:{findFirst:marker},companySubscription:{findFirst:term},$queryRaw:raw,$executeRaw:execute};
const tx=client as unknown as Prisma.TransactionClient;
const now=new Date("2026-10-09T12:00:00Z"),validTerm={billingPeriod:"SIX_MONTH",startsAt:new Date("2026-10-01"),endsAt:new Date("2027-04-01")};
beforeEach(()=>{vi.clearAllMocks();marker.mockResolvedValue({metadata:{telecallerSeats:3}});term.mockResolvedValue(validTerm);sync.mockResolvedValue(null)});
describe("A028-F02 paid Telecaller atomicity",()=>{
 it("activates purchased seats using the same payment transaction",async()=>{await syncUnifiedTelecallerTargetInTx(tx,"order","company",now);expect(sync).toHaveBeenCalledWith(tx,{companyId:"company",seats:3,...validTerm})});
 it("propagates failure to roll back the enclosing payment activation",async()=>{sync.mockRejectedValue(new Error("activation failed"));await expect(syncUnifiedTelecallerTargetInTx(tx,"order","company",now)).rejects.toThrow("activation failed")});
 it("preserves ordinary purchases of subscriptions without a Telecaller target",async()=>{marker.mockResolvedValue(null);await syncUnifiedTelecallerTargetInTx(tx,"order","company",now);expect(sync).not.toHaveBeenCalled();expect(term).not.toHaveBeenCalled()});
 it("does not activate future renewal seats early",async()=>{term.mockResolvedValue({...validTerm,startsAt:new Date("2027-04-01"),endsAt:new Date("2027-10-01")});raw.mockResolvedValue([]);await syncUnifiedTelecallerTargetInTx(tx,"order","company",now);expect(sync).not.toHaveBeenCalled();expect(execute).toHaveBeenCalledOnce()});
});
