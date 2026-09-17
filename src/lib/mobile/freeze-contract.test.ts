import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MOBILE_API_PREFIX,
  MOBILE_API_VERSION,
  MOBILE_ENDPOINTS,
  MOBILE_HTTP_STATUS,
  MOBILE_PAGINATION,
  MOBILE_PUBLIC_ERROR_CODES,
  MOBILE_REPORT_NAMES,
  MOBILE_RETRY_CONTRACT,
} from "./contract";

describe("frozen mobile API v1 contract", () => {
  it("keeps the version, complete endpoint/method inventory, and route implementations", () => {
    expect(MOBILE_API_VERSION).toBe("v1");
    expect(MOBILE_API_PREFIX).toBe("/api/v1/mobile");
    expect(MOBILE_ENDPOINTS).toHaveLength(23);
    expect(new Set(MOBILE_ENDPOINTS.map(([method, path]) => `${method} ${path}`)).size).toBe(23);
    for (const [, path] of MOBILE_ENDPOINTS) {
      expect(existsSync(join(process.cwd(), "src/app/api/v1/mobile", path, "route.ts"))).toBe(true);
    }
  });

  it("freezes status semantics and only exposes symbolic domain errors", () => {
    expect(MOBILE_HTTP_STATUS).toEqual({
      readOrUpdate: 200, create: 201, invalid: 400, unauthenticated: 401,
      forbidden: 403, absent: 404, conflict: 409, rateLimited: 429, unexpected: 500,
    });
    expect(MOBILE_PUBLIC_ERROR_CODES).toEqual(expect.arrayContaining(["UNAUTHORIZED", "FORBIDDEN", "SERVER_ERROR", "BRANCH_REQUIRED", "BRANCH_FORBIDDEN", "PHONE_IN_USE", "EMAIL_IN_USE", "ROW_LIMIT", "REPORT_TOO_LARGE"]));
    expect(MOBILE_PUBLIC_ERROR_CODES).not.toEqual(expect.arrayContaining(["MOBILE_UNAUTHORIZED", "MOBILE_FORBIDDEN", "TERMINAL", "NOT_AUTHORIZED", "P2002"]));
    for (const code of MOBILE_PUBLIC_ERROR_CODES) expect(code).toMatch(/^[A-Z][A-Z0-9_]*$/);
  });

  it("keeps list/report responses bounded and deterministically ordered", () => {
    expect(MOBILE_PAGINATION.reports).toMatchObject({defaultPageSize: 25, maxPageSize: 100, maxDateRangeDays: 366, orderingTieBreaker: "id desc"});
    expect(MOBILE_PAGINATION.leads).toMatchObject({maxItems: 200, ordering: "updatedAt desc"});
    expect(MOBILE_PAGINATION.targets).toMatchObject({maxItems: 100, ordering: "startDate desc, id desc"});
    expect(MOBILE_PAGINATION.followUps).toMatchObject({maxItems: 300, ordering: "dueDate asc, createdAt asc, id asc"});
    expect(MOBILE_REPORT_NAMES).toEqual(["attendance", "check-ins", "advanced-check-ins", "leads", "gps", "geofence", "targets"]);
  });

  it("records mutation retry behavior instead of promising universal idempotency", () => {
    expect(MOBILE_RETRY_CONTRACT.locationPoint).toBe("RETRY_RETURNS_EXISTING_RESULT");
    expect(MOBILE_RETRY_CONTRACT.pushRegistration).toBe("IDEMPOTENT_UPSERT");
    expect(MOBILE_RETRY_CONTRACT.attendanceStart).toBe("CONFLICT_ON_DUPLICATE");
    expect(MOBILE_RETRY_CONTRACT.followUpCreation).toBe("NOT_SAFE_TO_BLINDLY_RETRY");
  });
});
