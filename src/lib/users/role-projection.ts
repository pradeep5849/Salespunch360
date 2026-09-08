import type { AccountRole, Role, SalesRole } from "@prisma/client";

/** One-way compatibility projection for legacy consumers. Never use Role as canonical input. */
export function projectLegacyRole(input: {
  salesRole: SalesRole | null;
  accountRole: AccountRole | null;
  platformSuperAdmin?: boolean;
}): Role {
  if (input.platformSuperAdmin) return "SUPER_ADMIN";
  if (input.salesRole === "PRIMARY_ADMIN") return "COMPANY_ADMIN";
  if (input.salesRole === "ADMIN") return "FIELD_ADMIN";
  if (input.salesRole === "MANAGER") return "MANAGER";
  if (input.salesRole === "SALES") return "SALES";
  if (input.accountRole) return "ACCOUNT_USER";
  throw new Error("CANONICAL_ROLE_REQUIRED");
}
