import { z } from "zod";

export const salesRoleSchema = z.enum(["PRIMARY_ADMIN", "ADMIN", "MANAGER", "SALES"]);
export const accountRoleSchema = z.enum(["ACCOUNT_ADMIN", "ACCOUNTANT", "PROJECT_MANAGER", "DATA_ENTRY"]);
export const managerTypeSchema = z.enum(["FIELD_MANAGER", "MANAGER_ONLY"]);

/** Canonical role dimensions for new service operations; this does not rewrite historical users. */
export const canonicalUserRoleDimensionsSchema = z.object({
  salesRole: salesRoleSchema.nullable(),
  accountRole: accountRoleSchema.nullable(),
  managerType: managerTypeSchema.nullable(),
}).strict().superRefine((value, context) => {
  if (value.salesRole !== "MANAGER" && value.managerType !== null) {
    context.addIssue({ code: "custom", path: ["managerType"], message: "Manager type requires the Manager Sales role" });
  }
});
