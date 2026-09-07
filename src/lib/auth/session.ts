import type { AccountRole, ManagerType, Role, SalesRole } from "@prisma/client";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createSessionToken, hashSessionToken } from "./crypto";
import { canAuthenticate } from "./eligibility";
import { clearUserAuthentication, lockUser } from "./session-generation";

const COOKIE_NAME = "sp360_session";
const SESSION_DAYS = 30;

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  managerType: ManagerType | null;
  salesRole: SalesRole | null;
  accountRole: AccountRole | null;
  salesAccessActive: boolean;
  accountAccessActive: boolean;
  companyId: string | null;
};

const cookieOptions = (expires?: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
  expires,
});

export async function createSession(userId: string, remember = true, expectedPasswordHash?: string) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.$transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (!canAuthenticate(user) || (expectedPasswordHash && user?.passwordHash !== expectedPasswordHash))
      throw new Error("INVALID_CREDENTIALS");
    const rotated = await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } }, select: { sessionVersion: true } });
    await clearUserAuthentication(tx, userId);
    await tx.session.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt, sessionVersion: rotated.sessionVersion } });
  });
  (await cookies()).set(COOKIE_NAME, token, cookieOptions(remember ? expiresAt : undefined));
}

export const getAuthenticatedUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: { expiresAt: true, sessionVersion: true, user: { select: { id: true, name: true, email: true, role: true, managerType: true, salesRole: true, accountRole: true, salesAccessActive: true, accountAccessActive: true, companyId: true, isActive: true, sessionVersion: true } } },
  });
  if (!session || session.expiresAt <= new Date() || !canAuthenticate(session.user) || session.sessionVersion !== session.user.sessionVersion) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    isActive: session.user.isActive,
    managerType: session.user.managerType,
    salesRole: session.user.salesRole,
    accountRole: session.user.accountRole,
    salesAccessActive: session.user.salesAccessActive,
    accountAccessActive: session.user.accountAccessActive,
    companyId: session.user.companyId,
  };
});

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  cookieStore.set(COOKIE_NAME, "", cookieOptions(new Date(0)));
}

export async function revokeAllUserSessions(userId: string) {
  await db.$transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (!user) return;
    await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
    await clearUserAuthentication(tx, userId);
  });
}
