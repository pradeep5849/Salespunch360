import type { Role } from "@prisma/client";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createSessionToken, hashSessionToken } from "./crypto";

const COOKIE_NAME = "sp360_session";
const SESSION_DAYS = 30;

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string | null;
};

const cookieOptions = (expires: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
  expires,
});

export async function createSession(userId: string) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt } });
  (await cookies()).set(COOKIE_NAME, token, cookieOptions(expiresAt));
}

export const getAuthenticatedUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: { expiresAt: true, user: { select: { id: true, name: true, email: true, role: true, companyId: true } } },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
});

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  cookieStore.set(COOKIE_NAME, "", cookieOptions(new Date(0)));
}

export async function revokeAllUserSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}
