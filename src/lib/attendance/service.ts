import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/authorization";
import { haversineDistanceMeters } from "@/lib/location/geo";
import { calculateTravelDistanceMeters } from "@/lib/location/travel-route";
import {
  AttendancePolicyError,
  assertAttendanceStartFresh,
  assertCaptureTime,
  shouldAcceptLocationPoint,
} from "./policy";
import {
  attendanceMeasurementSchema,
  companyOperationsSchema,
  locationPointSchema,
} from "./validation";
import { evaluateGeofence } from "@/lib/geofence/policy";
import { deliverFieldEvent } from "@/lib/push/service";
import { assertOperationalWrite } from "@/lib/billing/entitlement";

async function requireEmployee() {
  const user = await requireRole("MANAGER", "SALES");
  if (!user.companyId || (user.role === "MANAGER" && user.managerType === "MANAGER_ONLY")) throw new AttendancePolicyError("DISABLED");
  return { ...user, companyId: user.companyId };
}

export async function getCurrentAttendance() {
  const user = await requireEmployee();
  const [attendance, company] = await Promise.all([
    db.attendance.findFirst({
      where: { companyId: user.companyId, userId: user.id, endedAt: null },
      include: { _count: { select: { locationPoints: true } } },
    }),
    db.company.findFirst({
      where: { id: user.companyId },
      select: {
        attendanceEnabled: true,
        gpsTrackingEnabled: true,
        attendanceGeofenceEnabled: true,
      },
    }),
  ]);
  if (!company) throw new AttendancePolicyError("DISABLED");
  return { attendance, settings: company };
}

export async function startAttendance(raw: unknown) {
  const user = await requireEmployee();
  await assertOperationalWrite(user.companyId);
  const { location } = attendanceMeasurementSchema.parse(raw);
  if (location) assertAttendanceStartFresh(location.capturedAt);
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
    const employee = await tx.user.findFirst({
      where: {
        id: user.id,
        companyId: user.companyId,
        role: { in: ["MANAGER", "SALES"] },
        isActive: true,
      },
      select: { id: true, managerType: true },
    });
    if (!employee || (user.role === "MANAGER" && employee.managerType === "MANAGER_ONLY")) throw new AttendancePolicyError("DISABLED");
    await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${user.companyId}::uuid FOR SHARE`;
    const company = await tx.company.findFirst({
      where: { id: user.companyId },
      select: {
        attendanceEnabled: true,
        gpsTrackingEnabled: true,
        attendanceGeofenceEnabled: true,
        attendanceReferenceLatitude: true,
        attendanceReferenceLongitude: true,
        attendanceGeofenceRadiusMeters: true,
      },
    });
    if (!company?.attendanceEnabled)
      throw new AttendancePolicyError("DISABLED");
    if (company.gpsTrackingEnabled && !location)
      throw new AttendancePolicyError("GPS_REQUIRED");
    const open = await tx.attendance.findFirst({
      where: { companyId: user.companyId, userId: user.id, endedAt: null },
      select: { id: true },
    });
    if (open) throw new AttendancePolicyError("ALREADY_OPEN");
    if (company.attendanceGeofenceEnabled) {
      if (
        !location ||
        company.attendanceReferenceLatitude == null ||
        company.attendanceReferenceLongitude == null ||
        company.attendanceGeofenceRadiusMeters == null
      )
        throw new AttendancePolicyError("GEOFENCE_CONFIGURATION");
      const verdict = evaluateGeofence(
        location,
        {
          latitude: company.attendanceReferenceLatitude,
          longitude: company.attendanceReferenceLongitude,
        },
        company.attendanceGeofenceRadiusMeters,
      );
      if (!verdict.allowed)
        return {
          blocked: {
            companyId: user.companyId,
            employeeId: user.id,
            type: verdict.type,
            action: "ATTENDANCE_START" as const,
            referenceLatitude: company.attendanceReferenceLatitude,
            referenceLongitude: company.attendanceReferenceLongitude,
            actualLatitude: location.latitude,
            actualLongitude: location.longitude,
            accuracyMeters: location.accuracyMeters,
            allowedRadiusMeters: company.attendanceGeofenceRadiusMeters,
            distanceMeters: verdict.distanceMeters,
          },
        };
    }
    const acceptedLocation =
      company.gpsTrackingEnabled || company.attendanceGeofenceEnabled
        ? location
        : undefined;
    return {
      attendance: await tx.attendance.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          startedAt: new Date(),
          startLatitude: acceptedLocation?.latitude,
          startLongitude: acceptedLocation?.longitude,
          startAccuracyMeters: acceptedLocation?.accuracyMeters,
        },
      }),
    };
  });
  if ("blocked" in result && result.blocked) {
    const blocked = result.blocked;
    await db.geofenceEvent.create({ data: blocked });
    throw new AttendancePolicyError(blocked.type);
  }
  await deliverFieldEvent({
    eventType: "ATTENDANCE_STARTED",
    actorUserId: user.id,
    attendanceId: result.attendance.id,
    occurredAt: result.attendance.startedAt,
  }).catch(() => undefined);
  return result.attendance;
}

export async function endAttendance(raw: unknown) {
  const user = await requireEmployee();
  const { location } = attendanceMeasurementSchema.parse(raw);
  const attendance = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
    const company = await tx.company.findFirst({
      where: { id: user.companyId },
      select: { gpsTrackingEnabled: true },
    });
    const open = await tx.attendance.findFirst({
      where: { companyId: user.companyId, userId: user.id, endedAt: null },
      select: { id: true },
    });
    if (!open) throw new AttendancePolicyError("NO_OPEN_ATTENDANCE");
    const acceptedLocation = company?.gpsTrackingEnabled ? location : undefined;
    return tx.attendance.update({
      where: { id: open.id },
      data: {
        endedAt: new Date(),
        endLatitude: acceptedLocation?.latitude,
        endLongitude: acceptedLocation?.longitude,
        endAccuracyMeters: acceptedLocation?.accuracyMeters,
      },
    });
  });
  await deliverFieldEvent({
    eventType: "ATTENDANCE_ENDED",
    actorUserId: user.id,
    attendanceId: attendance.id,
    occurredAt: attendance.endedAt!,
  }).catch(() => undefined);
  return attendance;
}

export async function uploadLocationPoint(raw: unknown) {
  const user = await requireEmployee();
  const point = locationPointSchema.parse(raw);
  const receivedAt = new Date();
  assertCaptureTime(point.capturedAt, receivedAt);
  return db.$transaction(async (tx) => {
    const company = await tx.company.findFirst({
      where: { id: user.companyId },
      select: { gpsTrackingEnabled: true },
    });
    if (!company?.gpsTrackingEnabled)
      throw new AttendancePolicyError("GPS_DISABLED");
    const attendance = await tx.attendance.findFirst({
      where: { companyId: user.companyId, userId: user.id, endedAt: null },
      select: { id: true },
    });
    if (!attendance) throw new AttendancePolicyError("NO_OPEN_ATTENDANCE");
    await tx.$queryRaw`SELECT "id" FROM "attendances" WHERE "id" = ${attendance.id}::uuid FOR UPDATE`;
    const previous = await tx.locationPoint.findFirst({
      where: { attendanceId: attendance.id },
      orderBy: { sequenceNumber: "desc" },
      select: {
        latitude: true,
        longitude: true,
        capturedAt: true,
        sequenceNumber: true,
      },
    });
    const distance = previous ? haversineDistanceMeters(previous, point) : 0;
    if (!shouldAcceptLocationPoint(previous, point, distance))
      throw new AttendancePolicyError("THROTTLED");
    return tx.locationPoint.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        attendanceId: attendance.id,
        latitude: point.latitude,
        longitude: point.longitude,
        accuracyMeters: point.accuracyMeters,
        capturedAt: point.capturedAt,
        receivedAt,
        sequenceNumber: (previous?.sequenceNumber ?? 0) + 1,
      },
    });
  });
}

export async function getAttendanceOverview() {
  const viewer = await requireRole("COMPANY_ADMIN", "MANAGER");
  if (!viewer.companyId) throw new AttendancePolicyError("DISABLED");
  return db.user.findMany({
    where: {
      companyId: viewer.companyId,
      ...(viewer.role === "MANAGER"
        ? { role: "SALES" as const, managerId: viewer.id }
        : { role: { in: ["MANAGER", "SALES"] as ("MANAGER" | "SALES")[] } }),
    },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
      attendances: {
        where: { endedAt: null },
        take: 1,
        select: {
          id: true,
          startedAt: true,
          _count: { select: { locationPoints: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getAttendanceRouteDistance(attendanceId: string) {
  const viewer = await requireRole("COMPANY_ADMIN", "MANAGER");
  if (!viewer.companyId) throw new AttendancePolicyError("DISABLED");
  const attendance = await db.attendance.findFirst({
    where: { id: attendanceId, companyId: viewer.companyId },
    select: {
      locationPoints: {
        orderBy: { sequenceNumber: "asc" },
        select: {
          id: true,
          latitude: true,
          longitude: true,
          accuracyMeters: true,
          capturedAt: true,
          sequenceNumber: true,
        },
      },
    },
  });
  if (!attendance) throw new AttendancePolicyError("NO_OPEN_ATTENDANCE");
  return calculateTravelDistanceMeters(attendance.locationPoints);
}

export async function updateCompanyOperations(raw: unknown) {
  const admin = await requireRole("COMPANY_ADMIN");
  if (!admin.companyId) throw new AttendancePolicyError("DISABLED");
  const data = companyOperationsSchema.parse(raw);
  return db.company.updateMany({ where: { id: admin.companyId }, data });
}

export async function getCompanyOperations() {
  const admin = await requireRole("COMPANY_ADMIN");
  if (!admin.companyId) throw new AttendancePolicyError("DISABLED");
  return db.company.findFirst({
    where: { id: admin.companyId },
    select: {
      attendanceEnabled: true,
      gpsTrackingEnabled: true,
      checkoutRequiredBeforeNextCheckIn: true,
    },
  });
}
