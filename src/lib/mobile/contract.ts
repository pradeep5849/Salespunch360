import { REPORT_DEFAULT_PAGE_SIZE, REPORT_MAX_DAYS, REPORT_MAX_PAGE_SIZE } from "@/lib/reports/config";

/**
 * Stable, code-readable description of the mobile v1 transport surface.
 * Validation remains in the route/service schemas; this file is deliberately
 * limited to values that clients and drift tests need to share.
 */
export const MOBILE_API_VERSION = "v1" as const;
export const MOBILE_API_PREFIX = `/api/${MOBILE_API_VERSION}/mobile` as const;

export const MOBILE_ENDPOINTS = [
  ["GET", "/attendance"], ["POST", "/attendance"],
  ["POST", "/auth/login"], ["POST", "/auth/logout"], ["POST", "/auth/password"],
  ["GET", "/bootstrap"],
  ["GET", "/company"], ["PATCH", "/company"],
  ["GET", "/employees"], ["POST", "/employees"], ["PATCH", "/employees"],
  ["GET", "/field"], ["POST", "/field"],
  ["GET", "/leads"], ["POST", "/leads"],
  ["POST", "/locations"], ["POST", "/push"], ["GET", "/reports"],
  ["POST", "/web-session"],
  ["GET", "/targets"], ["POST", "/targets"], ["PATCH", "/targets"],
] as const;

export type MobileMethod = (typeof MOBILE_ENDPOINTS)[number][0];
export type MobilePath = (typeof MOBILE_ENDPOINTS)[number][1];

/** Codes intentionally safe to branch on or display through a client-owned message. */
export const MOBILE_PUBLIC_ERROR_CODES = [
  "UNAUTHORIZED", "FORBIDDEN", "INVALID_INPUT", "INVALID_ACTION", "INVALID_ROLE",
  "INVALID_SECTION", "INVALID_BRANCH", "BRANCH_REQUIRED", "BRANCH_FORBIDDEN",
  "INVALID_REFERENCE", "INVALID_ASSIGNMENT", "INVALID_TRANSITION", "INVALID_DATE", "INVALID_STATE", "INVALID_REPORT",
  "INVALID_TARGET", "INVALID_ASSIGNEE", "NOT_FOUND", "STALE", "SERVER_ERROR",
  "CURRENT_PASSWORD_INCORRECT", "SEAT_LIMIT", "LIFECYCLE_BLOCKED", "MANAGERS_DISABLED",
  "INVALID_MANAGER", "EMAIL_VERIFICATION_REQUIRED", "COMPANY_PROFILE_REQUIRED", "PHONE_IN_USE", "EMAIL_IN_USE", "MANAGER_TYPE_CONFLICT",
  "SUBSCRIPTION_REQUIRED", "ATTENDANCE_DISABLED", "ATTENDANCE_REQUIRED", "ALREADY_OPEN",
  "NO_OPEN_ATTENDANCE", "GPS_REQUIRED", "GPS_DISABLED", "GEOFENCE_REQUIRED",
  "CAPTURE_TIME_INVALID", "OUTSIDE_RADIUS", "INSUFFICIENT_ACCURACY", "THROTTLED",
  "CHECKOUT_REQUIRED", "ACTIVE_FOLLOW_UP", "CUSTOMER_NOT_FOUND", "PHONE_REQUIRED",
  "PHOTO_REQUIRED", "PHOTO_INVALID", "PHOTO_STORAGE_NOT_CONFIGURED",
  "PHOTO_STORAGE_UNAVAILABLE", "REPEAT_VISIT_OUTSIDE_RADIUS",
  "SUBJECT_OWNERSHIP_CONFLICT", "VISIT_NOT_FOUND", "ROW_LIMIT", "REPORT_TOO_LARGE",
] as const;

export type MobilePublicErrorCode = (typeof MOBILE_PUBLIC_ERROR_CODES)[number];

export const MOBILE_HTTP_STATUS = {
  readOrUpdate: 200,
  create: 201,
  invalid: 400,
  unauthenticated: 401,
  forbidden: 403,
  absent: 404,
  conflict: 409,
  rateLimited: 429,
  unexpected: 500,
} as const;

export const MOBILE_PAGINATION = {
  reports: {
    style: "page" as const,
    defaultPageSize: REPORT_DEFAULT_PAGE_SIZE,
    maxPageSize: REPORT_MAX_PAGE_SIZE,
    maxDateRangeDays: REPORT_MAX_DAYS,
    orderingTieBreaker: "id desc",
  },
  leads: {
    style: "bounded-list" as const,
    maxItems: 200,
    ordering: "updatedAt desc",
  },
  targets: {
    style: "bounded-list" as const,
    maxItems: 100,
    ordering: "startDate desc, id desc",
  },
} as const;

export const MOBILE_RETRY_CONTRACT = {
  attendanceStart: "CONFLICT_ON_DUPLICATE",
  attendanceStop: "CONFLICT_ON_DUPLICATE",
  locationPoint: "RETRY_RETURNS_EXISTING_RESULT",
  fieldCheckIn: "CONFLICT_ON_DUPLICATE",
  fieldCheckout: "CONFLICT_ON_DUPLICATE",
  leadFromVisit: "UNIQUE_CONSTRAINT_PROTECTED",
  leadTransition: "OPTIMISTIC_VERSION_CONFLICT",
  followUpCreation: "NOT_SAFE_TO_BLINDLY_RETRY",
  pushRegistration: "IDEMPOTENT_UPSERT",
  targetCreate: "NOT_SAFE_TO_BLINDLY_RETRY",
  targetEdit: "OPTIMISTIC_VERSION_CONFLICT",
} as const;

export const MOBILE_REPORT_NAMES = [
  "attendance", "check-ins", "advanced-check-ins", "leads", "gps", "geofence", "targets",
] as const;
