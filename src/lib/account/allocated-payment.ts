import {AuthorizationError} from "@/lib/auth/authorization";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  settlementInput,
  createSettlementForActor,
  applyAdvanceForActor,
} from "./commercial";
import { inAccountTransaction } from "./transaction-scope";
import type { ProjectActor } from "./projects";
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
  if (input.allocations.some((row) => row.openingBalanceId))
    throw new Error("PARTIAL_OPENING_ALLOCATION_UNAVAILABLE");
  if (input.paymentMode === "CHEQUE")
    throw new Error("PARTIAL_CHEQUE_ALLOCATION_UNAVAILABLE");
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return inAccountTransaction(undefined, async (tx) => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id=${actor.companyId}::uuid FOR UPDATE`;
    const previous = await tx.accountOperationalAudit.findFirst({
      where: {
        companyId: actor.companyId,
        entityType: "ALLOCATED_PAYMENT",
        eventType: "PAYMENT_PLAN_COMMITTED",
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
    for (const row of input.allocations)
      await applyAdvanceForActor(
        actor,
        {
          advanceId: settlement.id,
          documentId: row.documentId,
          amount: row.amount,
          applicationDate: input.transactionDate,
          idempotencyKey: createHash("sha256")
            .update(`${input.idempotencyKey}:${row.documentId}`)
            .digest("hex"),
        },
        tx,
      );
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
  });
}
