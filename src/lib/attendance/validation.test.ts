import { describe, expect, it } from "vitest";
import { attendanceMeasurementSchema, companyOperationsSchema, coordinateSchema, locationPointSchema } from "./validation";

describe("attendance and location validation", () => {
  it("accepts valid coordinate boundaries and rejects invalid measurements", () => {
    expect(coordinateSchema.safeParse({ latitude: -90, longitude: 180, accuracyMeters: 0 }).success).toBe(true);
    expect(coordinateSchema.safeParse({ latitude: 91, longitude: 0 }).success).toBe(false);
    expect(coordinateSchema.safeParse({ latitude: 0, longitude: -181 }).success).toBe(false);
    expect(coordinateSchema.safeParse({ latitude: 0, longitude: 0, accuracyMeters: -1 }).success).toBe(false);
  });

  it.each(["companyId", "userId", "attendanceId", "startedAt", "endedAt"])("rejects browser-controlled %s", (field) => {
    expect(attendanceMeasurementSchema.safeParse({ [field]: "controlled" }).success).toBe(false);
  });

  it("validates device capture timestamps separately from server receipt time", () => {
    expect(locationPointSchema.safeParse({ latitude: 10, longitude: 20, accuracyMeters: 5, capturedAt: "2026-08-28T10:00:00.000Z" }).success).toBe(true);
    expect(locationPointSchema.safeParse({ latitude: 10, longitude: 20, capturedAt: "not-a-date" }).success).toBe(false);
  });

  it("requires a valid capture timestamp whenever an attendance location is supplied",()=>{const point={latitude:0,longitude:0,accuracyMeters:0,capturedAt:new Date().toISOString()};expect(attendanceMeasurementSchema.safeParse({location:point}).success).toBe(true);expect(attendanceMeasurementSchema.safeParse({location:{latitude:0,longitude:0}}).success).toBe(false);expect(attendanceMeasurementSchema.safeParse({location:{...point,capturedAt:"bad"}}).success).toBe(false)});

  it("rejects browser-controlled company settings fields", () => {
    expect(companyOperationsSchema.safeParse({ attendanceEnabled: true, gpsTrackingEnabled: false, checkoutRequiredBeforeNextCheckIn: true, companyId: "other" }).success).toBe(false);
  });
});
