import type { Prisma } from "@prisma/client";
import { editionAllowsAccountWorkspace, editionAllowsSalesWorkspace } from "./workspace-policy";
import { lockUser, revokeUserAuthenticationWithLock } from "./session-generation";

export class LifecycleError extends Error {
  constructor(public readonly code: "USER_NOT_FOUND" | "IDENTITY_INACTIVE" | "COMPANY_REQUIRED" | "ROLE_REQUIRED" | "EDITION_NOT_ALLOWED") {
    super(code);
    this.name = "LifecycleError";
  }
}

/** Globally disables an identity and revokes all authentication while preserving every role. */
export async function deactivateIdentityInTransaction(tx: Prisma.TransactionClient, userId: string) {
  const user = await lockUser(tx, userId);
  if (!user) throw new LifecycleError("USER_NOT_FOUND");
  await deactivateIdentityWithLock(tx, userId);
}

/** Same operation for callers that already hold the user lock via `lockUser`. */
export async function deactivateIdentityWithLock(tx: Prisma.TransactionClient, userId: string) {
  await tx.user.update({ where: { id: userId }, data: { isActive: false, salesAccessActive: false, accountAccessActive: false } });
  await revokeUserAuthenticationWithLock(tx, userId);
}

async function setWorkspaceAccess(tx: Prisma.TransactionClient, userId: string, workspace: "sales" | "account", active: boolean) {
  const user = await lockUser(tx, userId);
  if (!user) throw new LifecycleError("USER_NOT_FOUND");
  if (active) {
    if (!user.isActive) throw new LifecycleError("IDENTITY_INACTIVE");
    if (!user.companyId) throw new LifecycleError("COMPANY_REQUIRED");
    if (workspace === "sales" ? !user.salesRole : !user.accountRole) throw new LifecycleError("ROLE_REQUIRED");
    const company = await tx.company.findUnique({ where: { id: user.companyId }, select: { productEdition: true } });
    if (!company || !(workspace === "sales" ? editionAllowsSalesWorkspace(company.productEdition) : editionAllowsAccountWorkspace(company.productEdition)))
      throw new LifecycleError("EDITION_NOT_ALLOWED");
  }
  await tx.user.update({ where: { id: userId }, data: workspace === "sales" ? { salesAccessActive: active } : { accountAccessActive: active } });
  await revokeUserAuthenticationWithLock(tx, userId);
}

export const suspendSalesAccessInTransaction = (tx: Prisma.TransactionClient, userId: string) => setWorkspaceAccess(tx, userId, "sales", false);
export const suspendAccountAccessInTransaction = (tx: Prisma.TransactionClient, userId: string) => setWorkspaceAccess(tx, userId, "account", false);

/** Commercial/package/seat entitlement MUST be checked by the caller before activation. */
export const activateSalesAccessInTransaction = (tx: Prisma.TransactionClient, userId: string) => setWorkspaceAccess(tx, userId, "sales", true);
/** Commercial/package/seat entitlement MUST be checked by the caller before activation. */
export const activateAccountAccessInTransaction = (tx: Prisma.TransactionClient, userId: string) => setWorkspaceAccess(tx, userId, "account", true);
