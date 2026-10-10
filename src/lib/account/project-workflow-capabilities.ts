import type { AccountModule, ProductEdition } from "@prisma/client";
import { canUsePermission, type Permission } from "@/lib/auth/permissions";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-policy";
/** Business actions for the simple contract/payment/cost/close workflow. */
export function projectWorkflowCapabilities(
  actor: WorkspacePrincipal,
  edition: ProductEdition,
  modules: readonly AccountModule[],
) {
  const permission = (p: Permission) => canUsePermission(actor, edition, p);
  const project =
    modules.includes("PROJECTS") && permission("ACCOUNT_PROJECTS");
  return {
    paymentIn:
      project &&
      permission("ACCOUNT_SETTLEMENT_ENTRY") &&
      permission("ACCOUNT_JOURNAL_POST"),
    purchase: project && permission("ACCOUNT_PURCHASE_ENTRY"),
    expense: project && permission("ACCOUNT_EXPENSE_ENTRY"),
    material: project && permission("ACCOUNT_PROJECT_MATERIAL_VIEW"),
    extraJob:
      project &&
      modules.includes("PROJECT_COSTING") &&
      permission("ACCOUNT_PROJECT_COST_EDIT"),
    report:
      project &&
      modules.includes("PROJECT_COSTING") &&
      permission("ACCOUNT_PROJECT_COST_VIEW"),
    assignment: project && actor.accountRole === "ACCOUNT_ADMIN",
  };
}
