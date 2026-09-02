import type { ManagerType, Role } from "@prisma/client";
import { db } from "@/lib/db";
import {
  createSessionToken,
  hashSessionToken,
  verifyPassword,
} from "@/lib/auth/crypto";
import { effectiveEntitlement } from "@/lib/billing/entitlement";

const MOBILE_ROLES: Role[] = ["COMPANY_ADMIN", "MANAGER", "SALES"];
export const isMobileRole = (role: Role) => MOBILE_ROLES.includes(role);
const SESSION_DAYS = 30;
export type MobilePrincipal = {
  id: string;
  name: string;
  email: string;
  role: "COMPANY_ADMIN" | "MANAGER" | "SALES";
  managerType: ManagerType | null;
  companyId: string;
  mobileSessionId?: string;
};

export async function createMobileSession(
  identifier: string,
  password: string,
  now = new Date(),
) {
  const user = await db.user.findFirst({
    where: { OR: [{ email: identifier.toLowerCase() }, { phone: identifier }] },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
      managerType: true,
      companyId: true,
      isActive: true,
    },
  });
  const valid = Boolean(
    user?.isActive &&
    user.companyId &&
    isMobileRole(user.role) &&
    (await verifyPassword(user.passwordHash, password)),
  );
  if (!valid || !user?.companyId || user.role === "SUPER_ADMIN")
    throw new Error("INVALID_MOBILE_CREDENTIALS");
  const token = createSessionToken(),
    expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await db.mobileSession.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
      lastUsedAt: now,
    },
  });
  return {
    token,
    expiresAt,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as MobilePrincipal["role"],
      managerType: user.managerType,
      companyId: user.companyId,
    },
  };
}

export async function authenticateMobileToken(
  authorization: string | null,
  now = new Date(),
): Promise<MobilePrincipal> {
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{40,})$/);
  if (!match) throw new Error("MOBILE_UNAUTHORIZED");
  const session = await db.mobileSession.findUnique({
    where: { tokenHash: hashSessionToken(match[1]) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          managerType: true,
          companyId: true,
          isActive: true,
        },
      },
    },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= now ||
    !session.user.isActive ||
    !session.user.companyId ||
    !MOBILE_ROLES.includes(session.user.role)
  )
    throw new Error("MOBILE_UNAUTHORIZED");
  if (now.getTime() - session.lastUsedAt.getTime() > 300_000)
    await db.mobileSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { lastUsedAt: now },
    });
  return {
    ...session.user,
    companyId: session.user.companyId,
    role: session.user.role as MobilePrincipal["role"],
    mobileSessionId: session.id,
  };
}

export async function revokeMobileToken(authorization: string | null) {
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{40,})$/);
  if (match)
    await db.$transaction(async (tx) => {
      const session = await tx.mobileSession.findUnique({
        where: { tokenHash: hashSessionToken(match[1]) },
        select: { id: true },
      });
      if (!session) return;
      await tx.mobileSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.pushDevice.deleteMany({
        where: { mobileSessionId: session.id },
      });
    });
}

export async function mobileBootstrap(user: MobilePrincipal) {
  const [company, attendance, entitlement] = await Promise.all([
    db.company.findUnique({
      where: { id: user.companyId },
      select: {
        name: true,
        addressLine1: true,
        addressLine2: true,
        locality: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        teamStructure: true,
        attendanceEnabled: true,
        gpsTrackingEnabled: true,
      },
    }),
    user.role === "COMPANY_ADMIN" || (user.role === "MANAGER" && user.managerType === "MANAGER_ONLY")
      ? Promise.resolve(null)
      : db.attendance.findFirst({
          where: { companyId: user.companyId, userId: user.id, endedAt: null },
          select: { id: true, startedAt: true },
        }),
    effectiveEntitlement(user.companyId),
  ]);
  if (!company) throw new Error("MOBILE_UNAUTHORIZED");
  const address = [
    company.addressLine1,
    company.addressLine2,
    company.locality,
    company.city,
    company.state,
    company.postalCode,
    company.country,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, managerType: user.managerType },
    company: { name: company.name, logoUrl: null, address: address || null },
    teamStructure: company.teamStructure,
    features: {
      attendanceEnabled: company.attendanceEnabled,
      gpsTrackingEnabled: company.gpsTrackingEnabled,
      fieldWorkEnabled: user.role === "SALES" || (user.role === "MANAGER" && user.managerType !== "MANAGER_ONLY"),
    },
    entitlement: {
      state: entitlement.state,
      operationalWritesAllowed: entitlement.operationalWritesAllowed,
      managerLimit: entitlement.managerLimit,
      salesLimit: entitlement.salesLimit,
      managerUsage: entitlement.managerUsage,
      salesUsage: entitlement.salesUsage,
    },
    attendance,
  };
}
