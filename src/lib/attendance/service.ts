import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/authorization";
import { haversineDistanceMeters, calculateRouteDistanceMeters } from "@/lib/location/geo";
import { AttendancePolicyError, assertCaptureTime, shouldAcceptLocationPoint } from "./policy";
import { attendanceMeasurementSchema, companyOperationsSchema, locationPointSchema } from "./validation";

async function requireEmployee() {
  const user = await requireRole("MANAGER", "SALES");
  if (!user.companyId) throw new AttendancePolicyError("DISABLED");
  return { ...user, companyId: user.companyId };
}

export async function getCurrentAttendance() {
  const user = await requireEmployee();
  const [attendance, company] = await Promise.all([
    db.attendance.findFirst({ where: { companyId: user.companyId, userId: user.id, endedAt: null }, include: { _count: { select: { locationPoints: true } } } }),
    db.company.findFirst({ where: { id: user.companyId }, select: { attendanceEnabled: true, gpsTrackingEnabled: true } }),
  ]);
  if (!company) throw new AttendancePolicyError("DISABLED");
  return { attendance, settings: company };
}

export async function startAttendance(raw: unknown) {
  const user = await requireEmployee();
  const { location } = attendanceMeasurementSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
    const employee = await tx.user.findFirst({ where: { id: user.id, companyId: user.companyId, role: { in: ["MANAGER", "SALES"] }, isActive: true }, select: { id: true } });
    if (!employee) throw new AttendancePolicyError("DISABLED");
    const company = await tx.company.findFirst({ where: { id: user.companyId }, select: { attendanceEnabled: true, gpsTrackingEnabled: true } });
    if (!company?.attendanceEnabled) throw new AttendancePolicyError("DISABLED");
    const open = await tx.attendance.findFirst({ where: { companyId: user.companyId, userId: user.id, endedAt: null }, select: { id: true } });
    if (open) throw new AttendancePolicyError("ALREADY_OPEN");
    const acceptedLocation = company.gpsTrackingEnabled ? location : undefined;
    return tx.attendance.create({ data: {
      companyId: user.companyId, userId: user.id, startedAt: new Date(),
      startLatitude: acceptedLocation?.latitude, startLongitude: acceptedLocation?.longitude,
      startAccuracyMeters: acceptedLocation?.accuracyMeters,
    } });
  });
}

export async function endAttendance(raw: unknown) {
  const user = await requireEmployee();
  const { location } = attendanceMeasurementSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
    const company = await tx.company.findFirst({ where: { id: user.companyId }, select: { gpsTrackingEnabled: true } });
    const open = await tx.attendance.findFirst({ where: { companyId: user.companyId, userId: user.id, endedAt: null }, select: { id: true } });
    if (!open) throw new AttendancePolicyError("NO_OPEN_ATTENDANCE");
    const acceptedLocation = company?.gpsTrackingEnabled ? location : undefined;
    return tx.attendance.update({ where: { id: open.id }, data: {
      endedAt: new Date(), endLatitude: acceptedLocation?.latitude,
      endLongitude: acceptedLocation?.longitude, endAccuracyMeters: acceptedLocation?.accuracyMeters,
    } });
  });
}

export async function uploadLocationPoint(raw: unknown) {
  const user = await requireEmployee();
  const point = locationPointSchema.parse(raw);
  const receivedAt = new Date();
  assertCaptureTime(point.capturedAt, receivedAt);
  return db.$transaction(async (tx) => {
    const company = await tx.company.findFirst({ where: { id: user.companyId }, select: { gpsTrackingEnabled: true } });
    if (!company?.gpsTrackingEnabled) throw new AttendancePolicyError("GPS_DISABLED");
    const attendance = await tx.attendance.findFirst({ where: { companyId: user.companyId, userId: user.id, endedAt: null }, select: { id: true } });
    if (!attendance) throw new AttendancePolicyError("NO_OPEN_ATTENDANCE");
    await tx.$queryRaw`SELECT "id" FROM "attendances" WHERE "id" = ${attendance.id}::uuid FOR UPDATE`;
    const previous = await tx.locationPoint.findFirst({ where: { attendanceId: attendance.id }, orderBy: { sequenceNumber: "desc" }, select: { latitude: true, longitude: true, capturedAt: true, sequenceNumber: true } });
    const distance = previous ? haversineDistanceMeters(previous, point) : 0;
    if (!shouldAcceptLocationPoint(previous, point, distance)) throw new AttendancePolicyError("THROTTLED");
    return tx.locationPoint.create({ data: {
      companyId: user.companyId, userId: user.id, attendanceId: attendance.id,
      latitude: point.latitude, longitude: point.longitude, accuracyMeters: point.accuracyMeters,
      capturedAt: point.capturedAt, receivedAt, sequenceNumber: (previous?.sequenceNumber ?? 0) + 1,
    } });
  });
}

export async function getAttendanceOverview() {
  const viewer = await requireRole("COMPANY_ADMIN", "MANAGER");
  if (!viewer.companyId) throw new AttendancePolicyError("DISABLED");
  return db.user.findMany({
    where: { companyId: viewer.companyId, role: { in: ["MANAGER", "SALES"] } },
    select: { id: true, name: true, role: true, isActive: true, attendances: { where: { endedAt: null }, take: 1, select: { id: true, startedAt: true, _count: { select: { locationPoints: true } } } } },
    orderBy: { name: "asc" },
  });
}

export async function getAttendanceRouteDistance(attendanceId: string) {
  const viewer = await requireRole("COMPANY_ADMIN", "MANAGER");
  if (!viewer.companyId) throw new AttendancePolicyError("DISABLED");
  const attendance = await db.attendance.findFirst({ where: { id: attendanceId, companyId: viewer.companyId }, select: { locationPoints: { orderBy: { sequenceNumber: "asc" }, select: { latitude: true, longitude: true } } } });
  if (!attendance) throw new AttendancePolicyError("NO_OPEN_ATTENDANCE");
  return calculateRouteDistanceMeters(attendance.locationPoints);
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
  return db.company.findFirst({ where: { id: admin.companyId }, select: { attendanceEnabled: true, gpsTrackingEnabled: true } });
}
