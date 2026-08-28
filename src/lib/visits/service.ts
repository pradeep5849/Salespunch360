import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/authorization";
import { checkInSchema, checkoutSchema, type CheckInInput, type CheckoutInput } from "./validation";
import { assertPendingVisitAllowed, customerReferenceDistanceMeters, repeatVisitSummary, resolveAttendanceId, VisitPolicyError } from "./policy";

async function requireFieldEmployee() {
  const user = await requireRole("MANAGER", "SALES");
  if (!user.companyId) throw new VisitPolicyError("VISIT_NOT_FOUND");
  return { ...user, companyId: user.companyId };
}

export async function checkIn(raw: CheckInInput) {
  const user = await requireFieldEmployee();
  const data = checkInSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
    const employee = await tx.user.findFirst({ where: { id: user.id, companyId: user.companyId, isActive: true, role: { in: ["MANAGER", "SALES"] } }, select: { id: true } });
    if (!employee) throw new VisitPolicyError("VISIT_NOT_FOUND");
    const [company, customer, attendance, pendingCount] = await Promise.all([
      tx.company.findFirst({ where: { id: user.companyId }, select: { attendanceEnabled: true, checkoutRequiredBeforeNextCheckIn: true } }),
      tx.customer.findFirst({ where: { id: data.customerId, companyId: user.companyId }, select: { id: true, latitude: true, longitude: true } }),
      tx.attendance.findFirst({ where: { companyId: user.companyId, userId: user.id, endedAt: null }, select: { id: true } }),
      tx.customerVisit.count({ where: { companyId: user.companyId, userId: user.id, checkedOutAt: null } }),
    ]);
    if (!company || !customer) throw new VisitPolicyError("CUSTOMER_NOT_FOUND");
    const attendanceId = resolveAttendanceId(company.attendanceEnabled, attendance);
    assertPendingVisitAllowed(company.checkoutRequiredBeforeNextCheckIn, pendingCount);
    const previousVisitCount = await tx.customerVisit.count({ where: { companyId: user.companyId, customerId: customer.id } });
    const visit = await tx.customerVisit.create({ data: { companyId: user.companyId, userId: user.id, customerId: customer.id, attendanceId, checkedInAt: new Date(), checkInLatitude: data.location.latitude, checkInLongitude: data.location.longitude, checkInAccuracyMeters: data.location.accuracyMeters, visitNotes: data.visitNotes } });
    return { visit, ...repeatVisitSummary(previousVisitCount), customerReferenceDistanceMeters: customerReferenceDistanceMeters(customer, data.location) };
  });
}

export async function checkout(raw: CheckoutInput) {
  const user = await requireFieldEmployee();
  const data = checkoutSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const candidate = await tx.customerVisit.findFirst({ where: { id: data.visitId, companyId: user.companyId, userId: user.id, checkedOutAt: null }, select: { id: true } });
    if (!candidate) throw new VisitPolicyError("VISIT_NOT_FOUND");
    await tx.$queryRaw`SELECT "id" FROM "customer_visits" WHERE "id" = ${data.visitId}::uuid FOR UPDATE`;
    const employee = await tx.user.findFirst({ where: { id: user.id, companyId: user.companyId, isActive: true, role: { in: ["MANAGER", "SALES"] } }, select: { id: true } });
    if (!employee) throw new VisitPolicyError("VISIT_NOT_FOUND");
    const visit = await tx.customerVisit.findFirst({ where: { id: data.visitId, companyId: user.companyId, userId: user.id, checkedOutAt: null }, select: { id: true } });
    if (!visit) throw new VisitPolicyError("VISIT_NOT_FOUND");
    const updated = await tx.customerVisit.updateMany({ where: { id: visit.id, companyId: user.companyId, userId: user.id, checkedOutAt: null }, data: { checkedOutAt: new Date(), checkOutLatitude: data.location.latitude, checkOutLongitude: data.location.longitude, checkOutAccuracyMeters: data.location.accuracyMeters, checkoutSentiment: data.sentiment, checkoutRemarks: data.remarks } });
    if (updated.count !== 1) throw new VisitPolicyError("VISIT_NOT_FOUND");
  });
}

export async function getOwnPendingVisits() {
  const user = await requireFieldEmployee();
  return db.customerVisit.findMany({ where: { companyId: user.companyId, userId: user.id, checkedOutAt: null }, include: { customer: true }, orderBy: { checkedInAt: "desc" } });
}

export async function getVisibleRecentVisits() {
  const viewer = await requireRole("COMPANY_ADMIN", "MANAGER");
  if (!viewer.companyId) throw new VisitPolicyError("VISIT_NOT_FOUND");
  return db.customerVisit.findMany({ where: { companyId: viewer.companyId, ...(viewer.role === "MANAGER" ? { OR: [{ userId: viewer.id }, { user: { managerId: viewer.id, role: "SALES" } }] } : {}) }, include: { customer: { select: { name: true } }, user: { select: { name: true, role: true } } }, orderBy: { checkedInAt: "desc" }, take: 50 });
}
