import { db } from "@/lib/db";
import type { MobilePrincipal } from "@/lib/mobile/auth";
import { z } from "zod";
const schema = z
  .object({
    installationId: z.string().trim().min(16).max(128),
    fcmToken: z.string().trim().min(20).max(4096),
  })
  .strict();
export async function registerPushDevice(
  principal: MobilePrincipal,
  raw: unknown,
  now = new Date(),
) {
  const input = schema.parse(raw);
  if (!principal.mobileSessionId) throw new Error("MOBILE_UNAUTHORIZED");
  const mobileSessionId = principal.mobileSessionId;
  return db.$transaction(async (tx) => {
    await tx.pushDevice.deleteMany({
      where: {
        OR: [
          { installationId: input.installationId },
          { fcmToken: input.fcmToken },
        ],
        NOT: {
          installationId: input.installationId,
          fcmToken: input.fcmToken,
          mobileSessionId: mobileSessionId,
        },
      },
    });
    return tx.pushDevice.upsert({
      where: { installationId: input.installationId },
      create: {
        ...input,
        companyId: principal.companyId,
        userId: principal.id,
        mobileSessionId: mobileSessionId,
        lastSeenAt: now,
      },
      update: {
        fcmToken: input.fcmToken,
        companyId: principal.companyId,
        userId: principal.id,
        mobileSessionId: mobileSessionId,
        platform: "ANDROID",
        lastSeenAt: now,
      },
      select: { id: true, platform: true, lastSeenAt: true },
    });
  });
}
