import {AuthorizationError} from "@/lib/auth/authorization";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  settlementInput,
  createSettlementForActor,
  applyAdvanceForActor,
  applyAdvanceToOpeningForActor,
} from "./commercial";
import { inAccountTransaction } from "./transaction-scope";
import type { ProjectActor } from "./projects";
import {z} from "zod";
const pendingPlan=z.object({requestKey:z.string(),requestHash:z.string(),requestedType:z.string(),allocations:z.array(z.object({documentId:z.string().guid().optional(),openingBalanceId:z.string().guid().optional(),amount:z.string()}))});
export async function copyPendingPaymentPlan(tx:Prisma.TransactionClient,actor:ProjectActor,from:string,to:string){
 const plan=await tx.accountOperationalAudit.findFirst({where:{companyId:actor.companyId,entityType:"ALLOCATED_PAYMENT",entityId:from,eventType:"PAYMENT_PLAN_PENDING_CHEQUE"}});
 if(plan)await tx.accountOperationalAudit.create({data:{companyId:actor.companyId,actorUserId:actor.id,entityType:"ALLOCATED_PAYMENT",entityId:to,eventType:"PAYMENT_PLAN_PENDING_CHEQUE",metadata:plan.metadata as Prisma.InputJsonValue}});
}
/** Called only after cheque cash has posted, in the same financial transaction. */
export async function commitPendingPaymentPlan(tx:Prisma.TransactionClient,actor:ProjectActor,settlementId:string,date:Date){
 const stored=await tx.accountOperationalAudit.findFirst({where:{companyId:actor.companyId,entityType:"ALLOCATED_PAYMENT",entityId:settlementId,eventType:"PAYMENT_PLAN_PENDING_CHEQUE"}});
 if(!stored)return;
 const plan=pendingPlan.parse(stored.metadata);
 if(await tx.accountOperationalAudit.findFirst({where:{companyId:actor.companyId,entityType:"ALLOCATED_PAYMENT",entityId:settlementId,eventType:"PAYMENT_PLAN_COMMITTED"}}))return;
 for(const row of plan.allocations){
  const common={advanceId:settlementId,amount:row.amount,applicationDate:date,idempotencyKey:createHash("sha256").update(`${settlementId}:${row.documentId??row.openingBalanceId}`).digest("hex")};
  if(row.openingBalanceId)await applyAdvanceToOpeningForActor(actor,{...common,openingBalanceId:row.openingBalanceId},tx);
  else await applyAdvanceForActor(actor,{...common,documentId:row.documentId},tx);
 }
 await tx.accountOperationalAudit.create({data:{companyId:actor.companyId,actorUserId:actor.id,eventType:"PAYMENT_PLAN_COMMITTED",entityType:"ALLOCATED_PAYMENT",entityId:settlementId,metadata:{requestKey:plan.requestKey,requestHash:plan.requestHash,requestedType:plan.requestedType}}});
}
/** A partially linked cash payment is one advance receipt plus non-cash applications.
 * Every record commits together, and the original operation key binds the whole plan.
 */
export async function createAllocatedPaymentForActor(
  actor: ProjectActor,
  raw: unknown,
) {
  if(actor.accountRole!=="ACCOUNT_ADMIN"&&actor.accountRole!=="ACCOUNTANT")throw new AuthorizationError();
  const input = settlementInput.parse(raw);
  if (
    new Set(
      input.allocations.map((row) => row.documentId ?? row.openingBalanceId),
    ).size !== input.allocations.length
  )
    throw new Error("DUPLICATE_ALLOCATION");
  if (
    input.allocations.some(
      (row) =>
        !/^\d{1,16}(\.\d{1,2})?$/.test(row.amount) ||
        new Prisma.Decimal(row.amount).lte(0),
    )
  )
    throw new Error("INVALID_AMOUNT");
  const amount = new Prisma.Decimal(input.amount),
    allocated = input.allocations.reduce(
      (sum, row) => sum.add(row.amount),
      new Prisma.Decimal(0),
    );
  if (
    input.type.endsWith("ADVANCE") ||
    allocated.eq(amount) ||
    input.allocations.some((row) =>
      new Prisma.Decimal(row.discountAmount).gt(0),
    )
  )
    return createSettlementForActor(actor, input);
  if (allocated.gt(amount) || amount.lte(0))
    throw new Error("ALLOCATION_TOTAL_MISMATCH");
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return inAccountTransaction(undefined, async (tx) => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id=${actor.companyId}::uuid FOR UPDATE`;
    const previous = await tx.accountOperationalAudit.findFirst({
      where: {
        companyId: actor.companyId,
        entityType: "ALLOCATED_PAYMENT",
        eventType: {in:["PAYMENT_PLAN_COMMITTED","PAYMENT_PLAN_PENDING_CHEQUE"]},
        metadata: { path: ["requestKey"], equals: input.idempotencyKey },
      },
      select: { entityId: true, metadata: true },
    });
    if (previous) {
      if (
        (previous.metadata as { requestHash?: string } | null)?.requestHash !==
        hash
      )
        throw new Error("IDEMPOTENCY_KEY_REUSED");
      // Keep current role, branch and module checks on replay through the original cash service.
      return createSettlementForActor(
        actor,
        {
          ...input,
          type: input.type.startsWith("CUSTOMER")
            ? "CUSTOMER_ADVANCE"
            : "VENDOR_ADVANCE",
          allocations: [],
        },
        tx,
      );
    }
    const settlement = await createSettlementForActor(
      actor,
      {
        ...input,
        type: input.type.startsWith("CUSTOMER")
          ? "CUSTOMER_ADVANCE"
          : "VENDOR_ADVANCE",
        allocations: [],
      },
      tx,
    );
    if(input.paymentMode==="CHEQUE"){
      // Pending links are intent only. Final outstanding/period checks run atomically at clearance.
      for(const row of input.allocations){
        const target=row.openingBalanceId?await tx.partyOpeningBalance.findFirst({where:{id:row.openingBalanceId,companyId:actor.companyId,branchId:input.branchId,partyId:input.partyId,partyType:input.type.startsWith("CUSTOMER")?"CUSTOMER":"VENDOR",journalEntry:{is:{status:"POSTED"}}},select:{id:true}}):await tx.commercialDocument.findFirst({where:{id:row.documentId,companyId:actor.companyId,branchId:input.branchId,partyId:input.partyId,type:input.type.startsWith("CUSTOMER")?"SALES_INVOICE":"PURCHASE_BILL",status:"POSTED"},select:{id:true}});
        if(!target)throw new Error("INVALID_ALLOCATION_TARGET");
      }
      await tx.accountOperationalAudit.create({data:{companyId:actor.companyId,actorUserId:actor.id,eventType:"PAYMENT_PLAN_PENDING_CHEQUE",entityType:"ALLOCATED_PAYMENT",entityId:settlement.id,metadata:{requestKey:input.idempotencyKey,requestHash:hash,requestedType:input.type,allocations:input.allocations.map(row=>({...(row.documentId?{documentId:row.documentId}:{openingBalanceId:row.openingBalanceId!}),amount:row.amount}))}}});
      return settlement;
    }
    for (const row of input.allocations) {
      const common={advanceId:settlement.id,amount:row.amount,applicationDate:input.transactionDate,idempotencyKey:createHash("sha256").update(`${input.idempotencyKey}:${row.documentId??row.openingBalanceId}`).digest("hex")};
      if(row.openingBalanceId)await applyAdvanceToOpeningForActor(actor,{...common,openingBalanceId:row.openingBalanceId},tx);
      else await applyAdvanceForActor(actor,{...common,documentId:row.documentId},tx);
    }
    await tx.accountOperationalAudit.create({
      data: {
        companyId: actor.companyId,
        actorUserId: actor.id,
        eventType: "PAYMENT_PLAN_COMMITTED",
        entityType: "ALLOCATED_PAYMENT",
        entityId: settlement.id,
        metadata: {
          requestKey: input.idempotencyKey,
          requestHash: hash,
          requestedType: input.type,
        },
      },
    });
    return tx.accountSettlement.findUniqueOrThrow({
      where: { id: settlement.id },
    });
  }, {timeout:30000});
}
