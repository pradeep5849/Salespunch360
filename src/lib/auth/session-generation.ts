import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** Locking the account serializes competing login rotations for that account. */
export async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`);
  return tx.user.findUnique({ where: { id: userId } });
}

/** Must be called only while the user's row lock is held. */
export async function clearUserAuthentication(tx: Prisma.TransactionClient, userId: string) {
  await tx.pushDevice.deleteMany({ where: { userId } });
  await tx.session.deleteMany({ where: { userId } });
  await tx.mobileSession.deleteMany({ where: { userId } });
}

/**
 * Rotate the identity's session generation and remove every authentication
 * credential. The caller MUST already hold the user row lock via `lockUser`.
 */
export async function revokeUserAuthenticationWithLock(tx: Prisma.TransactionClient, userId: string) {
  await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
  await clearUserAuthentication(tx, userId);
}

export async function replacePasswordAndRevoke(userId: string, passwordHash: string, expectedPasswordHash?: string) {
  await db.$transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (!user || (expectedPasswordHash && user.passwordHash !== expectedPasswordHash)) throw new Error("STALE_CREDENTIALS");
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await revokeUserAuthenticationWithLock(tx, userId);
  });
}
