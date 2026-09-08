import type { Role, SalesRole } from "@prisma/client";

export type PrimaryAdminErrorCode =
  | "NOT_AUTHORIZED"
  | "PRIMARY_ADMIN_INVARIANT"
  | "INVALID_TRANSFER_TARGET"
  | "SELF_TRANSFER"
  | "NOT_FOUND";

export class PrimaryAdminPolicyError extends Error {
  constructor(readonly code: PrimaryAdminErrorCode) {
    super(code);
    this.name = "PrimaryAdminPolicyError";
  }
}

type CanonicalSalesIdentity = {
  id: string;
  companyId: string | null;
  role?: Role;
  salesRole: SalesRole | null;
  isActive: boolean;
  salesAccessActive: boolean;
};

/** Legacy role is deliberately not consulted: only canonical Sales state grants ownership. */
export function assertPrimaryAdminActor(actor: CanonicalSalesIdentity) {
  if (!actor.companyId || !actor.isActive || !actor.salesAccessActive || actor.salesRole !== "PRIMARY_ADMIN") {
    throw new PrimaryAdminPolicyError("NOT_AUTHORIZED");
  }
  return { ...actor, companyId: actor.companyId };
}

export function assertPrimaryAdminTransferTarget(
  actor: Pick<CanonicalSalesIdentity, "id" | "companyId">,
  target: CanonicalSalesIdentity | null,
) {
  if (target?.id === actor.id) throw new PrimaryAdminPolicyError("SELF_TRANSFER");
  if (!target || !actor.companyId || target.companyId !== actor.companyId || !target.isActive ||
      !target.salesAccessActive || target.salesRole !== "ADMIN") {
    throw new PrimaryAdminPolicyError("INVALID_TRANSFER_TARGET");
  }
  return target;
}

/** Ordinary lifecycle/edit/delete flows must not remove canonical Primary authority. */
export function assertOrdinaryMutationMayRemoveSalesAuthority(target: Pick<CanonicalSalesIdentity, "salesRole">) {
  if (target.salesRole === "PRIMARY_ADMIN") throw new PrimaryAdminPolicyError("PRIMARY_ADMIN_INVARIANT");
}
