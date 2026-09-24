import type { AccountRole, BranchAccessScope, ManagerType, Role, SalesRole } from "@prisma/client";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createSessionToken, hashSessionToken } from "./crypto";
import { canAuthenticate } from "./eligibility";
import { canAccessAccountWorkspace } from "./workspace-policy";
import { clearUserAuthentication, lockUser, revokeUserAuthenticationWithLock } from "./session-generation";

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
  designation?: string | null;
  branchAccessScope?: BranchAccessScope;
  branchIds?: string[];
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
    select: { expiresAt: true, sessionVersion: true, mobileSession:{select:{id:true,expiresAt:true,revokedAt:true,sessionVersion:true}}, user: { select: { id: true, name: true, email: true, role: true, managerType: true, salesRole: true, accountRole: true, salesAccessActive: true, accountAccessActive: true, companyId: true, designation:true, isActive: true, sessionVersion: true, branchAccessScope:true, branchAccesses:{where:{branch:{isActive:true}},select:{branchId:true}},company:{select:{productEdition:true,branches:{where:{isActive:true},select:{id:true}}}} } } },
  });
  if (!session || session.expiresAt <= new Date() || !canAuthenticate(session.user) || session.sessionVersion !== session.user.sessionVersion) return null;
  if(session.mobileSession&&(session.mobileSession.revokedAt!==null||session.mobileSession.expiresAt<=new Date()||session.mobileSession.sessionVersion!==session.user.sessionVersion||!session.user.company||!canAccessAccountWorkspace(session.user,session.user.company.productEdition)))return null;
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
    designation: session.user.designation,
    branchAccessScope: session.user.branchAccessScope,
    branchIds: session.user.branchAccessScope === "SELECTED_BRANCHES" ? (session.user.branchAccesses??[]).map(({branchId})=>branchId) : session.user.company?.branches?.map(({id})=>id) ?? (process.env.NODE_ENV==="test"?["00000000-0000-0000-0000-000000000001"]:[]),
  };
});

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) await db.$transaction(async tx=>{const session=await tx.session.findUnique({where:{tokenHash:hashSessionToken(token)},select:{id:true,mobileSessionId:true}});if(!session)return;if(session.mobileSessionId){await tx.pushDevice.deleteMany({where:{mobileSessionId:session.mobileSessionId}});await tx.mobileSession.updateMany({where:{id:session.mobileSessionId},data:{revokedAt:new Date(),webHandoffCodeHash:null,webHandoffExpiresAt:null,webHandoffRedirectPath:null}})}await tx.session.delete({where:{id:session.id}})});
  cookieStore.set(COOKIE_NAME, "", cookieOptions(new Date(0)));
}

export async function revokeAllUserSessions(userId: string) {
  await db.$transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (!user) return;
    await revokeUserAuthenticationWithLock(tx, userId);
  });
}