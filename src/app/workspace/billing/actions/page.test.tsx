import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({load:vi.fn()}));
vi.mock("../billing-page-data",()=>({loadBillingPageData:m.load}));
import Page from "./page";
beforeEach(()=>vi.clearAllMocks());
it("checks billing eligibility before rendering navigation",async()=>{m.load.mockRejectedValue(new Error("NOT_AUTHORIZED"));await expect(Page()).rejects.toThrow("NOT_AUTHORIZED");expect(m.load).toHaveBeenCalledOnce()});
it("keeps authorized company billing navigation available",async()=>{m.load.mockResolvedValue({r:{hasSales:false,hasAccount:true},e:null,accountCurrent:null,isPlus:false});expect(await Page()).toBeTruthy();expect(m.load).toHaveBeenCalledOnce()});
