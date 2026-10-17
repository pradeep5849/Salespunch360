import {expect,it,vi,beforeEach} from "vitest";
import {Prisma} from "@prisma/client";
const mocks=vi.hoisted(()=>({customer:vi.fn(),product:vi.fn(),price:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{customer:{findMany:mocks.customer},accountProduct:{findMany:mocks.product},productPrice:{findMany:mocks.price}}}));
import {customerPriceOptionsForActor} from "./customer-price-options";
beforeEach(()=>{vi.clearAllMocks();mocks.customer.mockResolvedValue([{id:"party"}]);mocks.product.mockResolvedValue([{id:"item"}]);mocks.price.mockResolvedValue([{id:"rate",productId:"item",customerId:"party",rate:new Prisma.Decimal(80),effectiveFrom:new Date("2026-10-01"),effectiveTo:null}])});
it("does not expose rates when inventory/party rates are off, company absent or actor is project manager",async()=>{
 for(const [actor,enabled] of [[{companyId:"company",accountRole:"ACCOUNT_ADMIN"},false],[{companyId:"",accountRole:null},true],[{companyId:"company",accountRole:"PROJECT_MANAGER"},true]] as const)expect(await customerPriceOptionsForActor(actor,enabled)).toEqual([]);
 expect(mocks.customer).not.toHaveBeenCalled();expect(mocks.price).not.toHaveBeenCalled();
});
it("limits party lookup to permitted branches and active company products and prices",async()=>{
 const result=await customerPriceOptionsForActor({companyId:"company",accountRole:"ACCOUNT_ADMIN",branchAccessScope:"SELECTED_BRANCHES",branchIds:["branch"]},true);
 expect(mocks.customer.mock.calls[0][0].where).toEqual({companyId:"company",isActive:true,isAccountCustomer:true,branchId:{in:["branch"]}});
 expect(mocks.price.mock.calls[0][0].where).toEqual({companyId:"company",isActive:true,priceType:"CUSTOMER",customerId:{in:["party"]},productId:{in:["item"]}});
 expect(result[0]).toMatchObject({rate:"80.00",effectiveFrom:"2026-10-01",effectiveTo:null});
});
it("queries no prices when no accessible customers exist",async()=>{mocks.customer.mockResolvedValue([]);expect(await customerPriceOptionsForActor({companyId:"company",accountRole:"ACCOUNT_ADMIN",branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},true)).toEqual([]);expect(mocks.price).not.toHaveBeenCalled()});
