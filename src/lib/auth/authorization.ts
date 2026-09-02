import type { Prisma, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getAuthenticatedUser, type AuthenticatedUser } from "./session";

export class AuthorizationError extends Error {
  constructor() { super("Not authorized"); this.name = "AuthorizationError"; }
}

export class AuthenticationError extends Error {
  constructor() { super("AUTHENTICATION_REQUIRED"); this.name = "AuthenticationError"; }
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** Authenticate a Server Action without emitting a NEXT_REDIRECT control-flow error. */
export async function requireUserForMutation(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) throw new AuthenticationError();
  return user;
}

export async function requireRoleForMutation(...roles: Role[]) {
  const user = await requireUserForMutation();
  if (!roles.includes(user.role)) throw new AuthorizationError();
  return user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthorizationError();
  return user;
}

export async function requireTenantUser() {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN" || !user.companyId) throw new AuthorizationError();
  return { ...user, companyId: user.companyId };
}

/** Build server-derived filters for every company-owned query; never accepts a browser tenant ID. */
export async function tenantWhere(where: Prisma.UserWhereInput = {}): Promise<Prisma.UserWhereInput> {
  const { companyId } = await requireTenantUser();
  return { ...where, companyId };
}

export function assertSameTenant(user: AuthenticatedUser, recordCompanyId: string) {
  if (!user.companyId || user.companyId !== recordCompanyId) throw new AuthorizationError();
}
