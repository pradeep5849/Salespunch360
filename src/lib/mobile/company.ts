import { db } from "@/lib/db";
import { companyOperationsSchema } from "@/lib/attendance/validation";
import { geofenceSettingsSchema } from "@/lib/geofence/validation";
import { effectiveEntitlement } from "@/lib/billing/entitlement";
import { currentPrices } from "@/lib/billing/service";
import { PAYMENT_PROVIDER_STATUS } from "@/lib/billing/provider";
import type { MobilePrincipal } from "./auth";

export class MobileCompanyError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

function admin(principal: MobilePrincipal) {
  if (principal.role !== "COMPANY_ADMIN") throw new MobileCompanyError("FORBIDDEN", 403);
  return principal.companyId;
}

const settingsSelect = {
  name: true, teamStructure: true, subscriptionStatus: true, trialStartedAt: true, trialEndsAt: true,
  attendanceEnabled: true, gpsTrackingEnabled: true, checkoutRequiredBeforeNextCheckIn: true,
  attendanceGeofenceEnabled: true, attendanceReferenceLatitude: true, attendanceReferenceLongitude: true,
  attendanceGeofenceRadiusMeters: true, customerCheckInGeofenceEnabled: true,
  customerCheckInGeofenceRadiusMeters: true,
} as const;

export async function mobileCompanyContext(principal: MobilePrincipal) {
  const companyId = admin(principal);
  const [company, entitlement, prices] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: settingsSelect }),
    effectiveEntitlement(companyId),
    currentPrices(),
  ]);
  if (!company) throw new MobileCompanyError("NOT_FOUND", 404);
  return {
    company,
    entitlement,
    prices,
    paymentProvider: PAYMENT_PROVIDER_STATUS,
    paymentMessage: "Online payment is currently unavailable.",
  };
}

export async function mobileUpdateCompany(principal: MobilePrincipal, raw: unknown) {
  const companyId = admin(principal);
  if (!raw || typeof raw !== "object") throw new MobileCompanyError("INVALID_INPUT");
  const input = raw as Record<string, unknown>;
  if (typeof input.section !== "string" || !("data" in input)) throw new MobileCompanyError("INVALID_INPUT");
  if (input.section === "operations") {
    const data = companyOperationsSchema.parse(input.data);
    await db.company.updateMany({ where: { id: companyId }, data });
  } else if (input.section === "geofence") {
    const data = geofenceSettingsSchema.parse(input.data);
    await db.company.updateMany({ where: { id: companyId }, data: {
      ...data,
      attendanceReferenceLatitude: data.attendanceReferenceLatitude ?? null,
      attendanceReferenceLongitude: data.attendanceReferenceLongitude ?? null,
      attendanceGeofenceRadiusMeters: data.attendanceGeofenceRadiusMeters ?? null,
      customerCheckInGeofenceRadiusMeters: data.customerCheckInGeofenceRadiusMeters ?? null,
    } });
  } else throw new MobileCompanyError("INVALID_SECTION");
  return mobileCompanyContext(principal);
}
