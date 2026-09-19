import { z } from "zod";
import { db } from "@/lib/db";
import { companyOperationsSchema } from "@/lib/attendance/validation";
import { geofenceSettingsSchema } from "@/lib/geofence/validation";
import { effectiveEntitlement } from "@/lib/billing/entitlement";
import { currentPrices } from "@/lib/billing/service";
import { PAYMENT_PROVIDER_STATUS } from "@/lib/billing/provider";
import { profileComplete } from "@/lib/company/profile";
import { mobileCan, type MobilePrincipal } from "./auth";

export class MobileCompanyError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

function admin(principal: MobilePrincipal) {
  if (!mobileCan(principal, "SALES_SETTINGS")) throw new MobileCompanyError("FORBIDDEN", 403);
  return principal.companyId;
}

const optionalText = (max: number) => z.preprocess(
  value => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(max).nullable().optional(),
);
const companyProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  addressLine1: z.string().trim().min(2).max(200),
  addressLine2: optionalText(200),
  locality: optionalText(120),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(120),
  postalCode: z.string().trim().min(3).max(20),
  country: z.string().trim().min(2).max(120),
  primaryContactName: z.string().trim().min(2).max(120),
  primaryPhone: z.string().trim().min(5).max(30),
  contactEmail: z.string().trim().email().max(320).transform(value => value.toLowerCase()),
}).strict();

const settingsSelect = {
  name: true, teamStructure: true, subscriptionStatus: true, trialStartedAt: true, trialEndsAt: true,
  addressLine1: true, addressLine2: true, locality: true, city: true, state: true, postalCode: true,
  country: true, primaryContactName: true, primaryPhone: true, contactEmail: true,
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
    company: {
      ...company,
      profileComplete: profileComplete(company as unknown as Record<string, unknown>),
    },
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
  } else if (input.section === "profile") {
    const data = companyProfileSchema.parse(input.data);
    await db.$transaction(async tx => {
      await tx.company.updateMany({ where: { id: companyId }, data: {
        ...data,
        addressLine2: data.addressLine2 ?? null,
        locality: data.locality ?? null,
      } });
      await tx.branch.updateMany({
        where: { companyId, isPrimary: true },
        data: {
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2 ?? null,
          locality: data.locality ?? null,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country,
          phone: data.primaryPhone,
          email: data.contactEmail,
        },
      });
    });
  } else throw new MobileCompanyError("INVALID_SECTION");
  return mobileCompanyContext(principal);
}
