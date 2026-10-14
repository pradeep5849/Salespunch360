import { Prisma } from "@prisma/client";
import { expect, it } from "vitest";
import { fundingReturnsSchema, remainingFunding } from "./owner-asset-funding";
it("preserves funding amounts exactly and rejects corrupted over-repayment", () => {
  expect(
    remainingFunding({
      amount: new Prisma.Decimal("30000"),
      returned: new Prisma.Decimal("5000"),
    }).toFixed(2),
  ).toBe("25000.00");
  expect(
    remainingFunding({
      amount: new Prisma.Decimal("9007199254740993.01"),
      returned: new Prisma.Decimal("0.01"),
    }).toFixed(2),
  ).toBe("9007199254740993.00");
  expect(() =>
    remainingFunding({
      amount: new Prisma.Decimal(1),
      returned: new Prisma.Decimal(2),
    }),
  ).toThrow("ASSET_FUNDING_INVALID_STATE");
});
it("normalizes repayment identity and rejects duplicate or zero allocations", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  expect(fundingReturnsSchema.parse([{ fundingId: id, amount: "5" }])).toEqual([
    { fundingId: id, amount: "5.00" },
  ]);
  expect(() =>
    fundingReturnsSchema.parse([
      { fundingId: id, amount: "5" },
      { fundingId: id, amount: "5" },
    ]),
  ).toThrow();
  expect(() =>
    fundingReturnsSchema.parse([{ fundingId: id, amount: "0" }]),
  ).toThrow();
});

it("keeps one-cent unallocated capital available when reserved funding spans many large assets",async()=>{
 const {vi}=await import("vitest"),{validateFundingReturnsInTx,assertOwnerAssetFundingCapitalInTx}=await import("./owner-asset-funding");
 const id=(value:number)=>`00000000-0000-4000-8000-${String(value).padStart(12,"0")}`;
 const rows=Array.from({length:101},(_,index)=>({id:id(1000+index),companyId:id(1),branchId:id(3),assetId:id(100+index),assetName:"Equipment",ownerFinancialAccountId:id(2),ownerName:"Owner",contributionTransactionId:id(2000+index),amount:new Prisma.Decimal("9999999999999999.99"),purchaseValue:new Prisma.Decimal("9999999999999999.99"),returned:new Prisma.Decimal(0),allocationDate:new Date("2026-10-10")}));
 const tx={$queryRaw:vi.fn().mockResolvedValue(rows),ownerFinancialAccount:{findMany:vi.fn().mockResolvedValue([{id:id(2),capitalLedgerId:id(5)}])},journalLine:{aggregate:vi.fn().mockResolvedValue({_sum:{credit:new Prisma.Decimal("1009999999999999999.00"),debit:new Prisma.Decimal(0)}})}} as unknown as Prisma.TransactionClient;
 const actor={id:id(4),companyId:id(1),name:"Owner",email:"owner@example.test",role:"ACCOUNT_USER",isActive:true,managerType:null,salesRole:null,salesAccessActive:false,accountAccessActive:true,accountRole:"ACCOUNT_ADMIN",branchAccessScope:"ALL_BRANCHES",branchIds:[]} as import("./projects").ProjectActor;
 const input={ownerFinancialAccountId:id(2),branchId:id(3),transactionDate:new Date("2026-10-11"),amount:"0.01",fundingReturns:[]};
 await expect(validateFundingReturnsInTx(tx,actor,input,id(5))).resolves.toBeUndefined();
 await expect(validateFundingReturnsInTx(tx,actor,{...input,amount:"0.02"},id(5))).rejects.toThrow("ASSET_FUNDING_ATTRIBUTION_REQUIRED");
 await expect(assertOwnerAssetFundingCapitalInTx(tx,id(1),[{ledgerAccountId:id(5),debit:"0.01",credit:"0"}])).resolves.toBeUndefined();
 await expect(assertOwnerAssetFundingCapitalInTx(tx,id(1),[{ledgerAccountId:id(5),debit:"0.02",credit:"0"}])).rejects.toThrow("ASSET_FUNDING_ATTRIBUTION_REQUIRED");
});
