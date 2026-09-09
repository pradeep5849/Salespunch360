import type { AccountRole } from "@prisma/client";

export const ACCOUNT_CAPABILITIES = ["VIEW", "CREATE", "EDIT", "APPROVE", "FINANCIAL_VISIBILITY", "COST_PROFIT_VISIBILITY", "SETTINGS_ACCESS"] as const;
export type AccountCapability = typeof ACCOUNT_CAPABILITIES[number];
export const ACCOUNT_ROLE_CAPABILITIES: Readonly<Record<AccountRole, readonly AccountCapability[]>> = Object.freeze({
  ACCOUNT_ADMIN: ACCOUNT_CAPABILITIES,
  ACCOUNTANT: ["VIEW", "CREATE", "EDIT", "APPROVE", "FINANCIAL_VISIBILITY", "COST_PROFIT_VISIBILITY"],
  PROJECT_MANAGER: ["VIEW", "CREATE", "EDIT", "APPROVE", "COST_PROFIT_VISIBILITY"],
  DATA_ENTRY: ["VIEW", "CREATE", "EDIT"],
});
export const accountRoleHasCapability = (role: AccountRole | null, capability: AccountCapability) => role !== null && ACCOUNT_ROLE_CAPABILITIES[role].includes(capability);
