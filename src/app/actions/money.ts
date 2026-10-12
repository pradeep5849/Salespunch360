"use server";
import { revalidatePath } from "next/cache";
import {
  createAndReceiveLoan,
  createCheque,
  createMoneyAccount,
  createMoneyTransfer,
  postLoanPayment,
  postOwnerTransaction,
  setupOwnerFinancialAccount,
  transitionCheque,
} from "@/lib/account/money";
const raw = (fd: FormData) => Object.fromEntries(fd.entries()),
  refresh = () => revalidatePath("/workspace/account/money", "layout");
export async function moneyAccountAction(fd: FormData) {
  await createMoneyAccount(raw(fd));
  refresh();
}
export async function transferAction(fd: FormData) {
  await createMoneyTransfer(raw(fd));
  refresh();
}
export async function chequeAction(fd: FormData) {
  if (fd.get("id"))
    await transitionCheque(
      String(fd.get("id")),
      String(fd.get("status")) as never,
      fd.get("clearedDate")
        ? new Date(String(fd.get("clearedDate")))
        : undefined,
    );
  else await createCheque(raw(fd));
  refresh();
}
export async function setupOwnerAction(fd: FormData) {
  await setupOwnerFinancialAccount(
    String(fd.get("userId")),
    String(fd.get("branchId")),
  );
  refresh();
}
export async function ownerTransactionAction(fd: FormData) {
  await postOwnerTransaction(raw(fd));
  refresh();
}
export async function loanAction(fd: FormData) {
  await createAndReceiveLoan(raw(fd));
  refresh();
}
export async function loanPaymentAction(fd: FormData) {
  await postLoanPayment(raw(fd));
  refresh();
}

export async function saveChequeAction(fd: FormData) {
  const { accountAction } = await import("@/lib/account/action-feedback");
  return accountAction(
    async () => {
      await chequeAction(fd);
    },
    fd.get("id") ? "Cheque status updated" : "Cheque recorded",
  );
}

export async function saveChequeFinancialAction(fd: FormData) {
  const { accountAction } = await import("@/lib/account/action-feedback");
  const { requirePermissionForMutation } =
    await import("@/lib/auth/authorization");
  const { chequeFinancialActionForActor } =
    await import("@/lib/account/cheque-finance");
  return accountAction(async () => {
    const actor = await requirePermissionForMutation("ACCOUNT_MONEY_ENTRY");
    const input = Object.fromEntries(fd.entries());
    delete input.id;
    if (!actor.companyId) throw new Error("NOT_AUTHORIZED");
    await chequeFinancialActionForActor(
      { ...actor, companyId: actor.companyId },
      String(fd.get("id")),
      {
        ...input,
        expectedVersion: Number(fd.get("expectedVersion")),
      },
    );
    refresh();
  }, "Cheque updated");
}

export async function searchChequeParties(rawInput: unknown) {
  const { z } = await import("zod");
  const { db } = await import("@/lib/db");
  const { requirePermissionForMutation, AuthorizationError } =
    await import("@/lib/auth/authorization");
  const input = z
    .object({
      branchId: z.string().uuid(),
      direction: z.enum(["RECEIVED", "ISSUED"]),
      q: z.string().trim().max(160),
      offset: z.number().int().min(0).max(1000000),
    })
    .strict()
    .parse(rawInput);
  const actor = await requirePermissionForMutation("ACCOUNT_MONEY_ENTRY");
  if (
    !actor.companyId ||
    (actor.branchAccessScope === "SELECTED_BRANCHES" &&
      !actor.branchIds?.includes(input.branchId))
  )
    throw new AuthorizationError();
  if (
    !(await db.branch.findFirst({
      where: { id: input.branchId, companyId: actor.companyId, isActive: true },
      select: { id: true },
    }))
  )
    throw new AuthorizationError();
  const where = {
    companyId: actor.companyId,
    isActive: true,
    name: { contains: input.q, mode: "insensitive" as const },
  };
  const rows =
    input.direction === "RECEIVED"
      ? await db.customer.findMany({
          where: { ...where, branchId: input.branchId },
          select: { id: true, name: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip: input.offset,
          take: 26,
        })
      : await db.vendor.findMany({
          where,
          select: { id: true, name: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip: input.offset,
          take: 26,
        });
  return { rows: rows.slice(0, 25), hasMore: rows.length > 25 };
}
