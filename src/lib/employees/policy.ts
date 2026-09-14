import type { SalesRole, SubscriptionStatus } from "@prisma/client";
import { DEFAULT_TRIAL_ENTITLEMENTS } from "@/lib/trial/config";

export class EmployeePolicyError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "INVALID_MANAGER" | "MANAGERS_DISABLED" | "LIFECYCLE_BLOCKED" | "SEAT_LIMIT" | "EMAIL_VERIFICATION_REQUIRED" | "COMPANY_PROFILE_REQUIRED" | "MANAGER_TYPE_CONFLICT" | "PHONE_IN_USE" | "EMAIL_IN_USE") {
    super(code);
  }
}

type ManagedUser = { companyId: string | null; salesRole: SalesRole | null; id: string; isActive: boolean; salesAccessActive: boolean; managerType?: string | null };
type ManagedEmployee = ManagedUser & { salesRole: "MANAGER" | "SALES" };

export function assertManagedEmployee(companyId: string, employee: ManagedUser | null): asserts employee is ManagedEmployee {
  if (!employee || employee.companyId !== companyId || (employee.salesRole !== "MANAGER" && employee.salesRole !== "SALES")) {
    throw new EmployeePolicyError("NOT_FOUND");
  }
}

export function assertAssignableManager(companyId: string, manager: ManagedUser | null): asserts manager is ManagedUser {
  if (!manager || manager.companyId !== companyId || manager.salesRole !== "MANAGER" || !manager.isActive || !manager.salesAccessActive) {
    throw new EmployeePolicyError("INVALID_MANAGER");
  }
}

export function assertCanActivate(effectiveStatus: SubscriptionStatus, role: "MANAGER" | "SALES", activeCount: number) {
  if (effectiveStatus === "EXPIRED" || effectiveStatus === "SUSPENDED") {
    throw new EmployeePolicyError("LIFECYCLE_BLOCKED");
  }
  if (effectiveStatus === "TRIAL") {
    const limit = role === "MANAGER" ? DEFAULT_TRIAL_ENTITLEMENTS.manager : DEFAULT_TRIAL_ENTITLEMENTS.sales;
    if (activeCount >= limit) throw new EmployeePolicyError("SEAT_LIMIT");
  }
  // ACTIVE is intentionally unlimited until paid-plan enforcement is introduced in Stage 9.
}
