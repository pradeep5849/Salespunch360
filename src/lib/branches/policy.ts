import type { Role, SalesRole } from "@prisma/client";

export class BranchAssignmentError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "INVALID_BRANCH" | "INVARIANT_VIOLATION") {
    super(code);
    this.name = "BranchAssignmentError";
  }
}

type AssignmentTarget = { companyId: string | null; salesRole: SalesRole | null; role: Role } | null;

/** Canonical Sales role grants eligibility; legacy SUPER_ADMIN is only an F1-trigger compatibility veto. */
export function assertBranchAssignmentTarget<T extends AssignmentTarget>(companyId: string, target: T): asserts target is T & { companyId: string; salesRole: "MANAGER" | "SALES" } {
  if (!target || target.companyId !== companyId || target.role === "SUPER_ADMIN" || (target.salesRole !== "MANAGER" && target.salesRole !== "SALES")) {
    throw new BranchAssignmentError("NOT_FOUND");
  }
}
