import type { AccountRole, ProductEdition, Role, SalesRole, SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getTrialStatus } from "@/lib/trial/status";
import { accountPackageCapacity } from "@/lib/billing/account-package";
import { editionAllowsAccountWorkspace, editionAllowsSalesWorkspace } from "@/lib/auth/workspace-policy";

export const SALES_TRIAL_SEATS = Object.freeze({ manager: 1, sales: 5 });

export function productEntitlements(edition: ProductEdition) {
  return Object.freeze({ edition, sales: editionAllowsSalesWorkspace(edition), account: editionAllowsAccountWorkspace(edition), plus: edition === "SALESPUNCH360_PLUS" });
}

export function assertIndependentRoles(input: { salesRoles?: readonly SalesRole[]; accountRoles?: readonly AccountRole[] }) {
  if ((input.salesRoles?.length ?? 0) > 1) throw new Error("MULTIPLE_SALES_ROLES");
  if ((input.accountRoles?.length ?? 0) > 1) throw new Error("MULTIPLE_ACCOUNT_ROLES");
  return { salesRole: input.salesRoles?.[0] ?? null, accountRole: input.accountRoles?.[0] ?? null };
}

type CompanySnapshot = { id: string; productEdition: ProductEdition; accountPackageQuantity: number; trialStartedAt: Date | null; trialEndsAt: Date | null; subscriptionStatus: SubscriptionStatus; teamStructure: "MANAGERS_AND_SALES" | "SALES_ONLY" };
export function describeCompanyEntitlement(company: CompanySnapshot, now = new Date()) {
  const product = productEntitlements(company.productEdition);
  const trial = getTrialStatus(company, now);
  return { ...product, source: trial.isInTrial ? "TRIAL" as const : company.subscriptionStatus === "ACTIVE" ? "PAID" as const : "NONE" as const, trial, salesSeats: product.sales && trial.isInTrial ? SALES_TRIAL_SEATS : null, accountPackages: product.account ? company.accountPackageQuantity : 0, accountSeats: accountPackageCapacity(product.account ? company.accountPackageQuantity : 0) };
}

/** Company identity is supplied by an authenticated server principal, never request input. */
export async function companyEntitlementForPrincipal(principal: { companyId: string | null; role: Role }, now = new Date()) {
  if (!principal.companyId || principal.role === "SUPER_ADMIN") throw new Error("TENANT_REQUIRED");
  const company = await db.company.findUnique({ where: { id: principal.companyId }, select: { id: true, productEdition: true, accountPackageQuantity: true, trialStartedAt: true, trialEndsAt: true, subscriptionStatus: true, teamStructure: true } });
  if (!company) throw new Error("ENTITLEMENT_UNAVAILABLE");
  return describeCompanyEntitlement(company, now);
}
