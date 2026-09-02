import { db } from "@/lib/db";
import { isInvalidFcmToken, sendFcm } from "./firebase";
export type FieldEvent = {
  eventType: "ATTENDANCE_STARTED" | "ATTENDANCE_ENDED" | "VISIT_CHECKOUT";
  actorUserId: string;
  attendanceId?: string;
  visitId?: string;
  occurredAt: Date;
  subject?: string;
  sentiment?: string;
};
const time = (date: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
export async function resolvePushDevices(
  actorUserId: string,
  now = new Date(),
) {
  const actor = await db.user.findFirst({
    where: {
      id: actorUserId,
      isActive: true,
      role: { in: ["MANAGER", "SALES"] },
      companyId: { not: null },
    },
    select: { id: true, companyId: true, role: true, managerId: true },
  });
  if (!actor?.companyId) return [];
  const recipients = await db.user.findMany({
    where: {
      companyId: actor.companyId,
      isActive: true,
      OR: [
        { role: "COMPANY_ADMIN" },
        ...(actor.role === "SALES" && actor.managerId
          ? [{ id: actor.managerId, role: "MANAGER" as const }]
          : []),
      ],
    },
    select: { id: true },
  });
  if (!recipients.length) return [];
  return db.pushDevice.findMany({
    where: {
      companyId: actor.companyId,
      userId: { in: recipients.map((x) => x.id) },
      mobileSession: {
        revokedAt: null,
        expiresAt: { gt: now },
        user: { isActive: true, companyId: actor.companyId },
      },
    },
    select: { id: true, fcmToken: true, userId: true },
  });
}
export async function deliverFieldEvent(event: FieldEvent) {
  try {
    const actor = await db.user.findFirst({
      where: { id: event.actorUserId },
      select: { name: true },
    });
    if (!actor) return;
    const devices = await resolvePushDevices(
      event.actorUserId,
      event.occurredAt,
    );
    if (!devices.length) return;
    const at = time(event.occurredAt);
    const body =
      event.eventType === "ATTENDANCE_STARTED"
        ? `${actor.name} started Attendance at ${at}`
        : event.eventType === "ATTENDANCE_ENDED"
          ? `${actor.name} ended Attendance at ${at}`
          : `${actor.name} checked out from ${event.subject || "Field prospect"} at ${at}${event.sentiment ? ` · ${event.sentiment[0] + event.sentiment.slice(1).toLowerCase()}` : ""}`;
    const data: Record<string, string> = {
      eventType: event.eventType,
      actorUserId: event.actorUserId,
    };
    if (event.attendanceId) data.attendanceId = event.attendanceId;
    if (event.visitId) data.visitId = event.visitId;
    await Promise.all(
      devices.map(async (device) => {
        try {
          await sendFcm({
            token: device.fcmToken,
            notification: { title: "SalesPunch360 field activity", body },
            data,
            android: {
              priority: "high",
              notification: { channelId: "field_activity" },
            },
          });
        } catch (error) {
          if (isInvalidFcmToken(error))
            await db.pushDevice
              .deleteMany({
                where: { id: device.id, fcmToken: device.fcmToken },
              })
              .catch(() => undefined);
        }
      }),
    );
  } catch {
    /* Push is deliberately best-effort and never affects field writes. */
  }
}
