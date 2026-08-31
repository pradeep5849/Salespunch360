import { describe, expect, it } from "vitest";
import { assertAttendanceOwnership, assertAttendanceStartFresh, assertCaptureTime, shouldAcceptLocationPoint } from "./policy";

describe("attendance ownership and GPS acceptance", () => {
  it("rejects attendance owned by another employee or company", () => {
    const authenticated = { id: "user-a", companyId: "company-a" };
    expect(() => assertAttendanceOwnership(authenticated, { userId: "user-b", companyId: "company-a" })).toThrow("NO_OPEN_ATTENDANCE");
    expect(() => assertAttendanceOwnership(authenticated, { userId: "user-a", companyId: "company-b" })).toThrow("NO_OPEN_ATTENDANCE");
  });

  it("accepts recent captures and rejects ancient or future timestamps", () => {
    const now = new Date("2026-08-28T12:00:00.000Z");
    expect(() => assertCaptureTime(new Date("2026-08-28T11:59:00.000Z"), now)).not.toThrow();
    expect(() => assertCaptureTime(new Date("2026-08-27T11:59:59.000Z"), now)).toThrow("CAPTURE_TIME_INVALID");
    expect(() => assertCaptureTime(new Date("2026-08-28T12:06:00.000Z"), now)).toThrow("CAPTURE_TIME_INVALID");
  });

  it("enforces the tighter attendance-start freshness window",()=>{const now=new Date("2026-08-28T12:00:00.000Z");expect(()=>assertAttendanceStartFresh(new Date("2026-08-28T11:58:01.000Z"),now)).not.toThrow();expect(()=>assertAttendanceStartFresh(new Date("2026-08-28T11:57:59.000Z"),now)).toThrow("CAPTURE_TIME_INVALID");expect(()=>assertAttendanceStartFresh(new Date("2026-08-28T12:00:31.000Z"),now)).toThrow("CAPTURE_TIME_INVALID")});

  it("throttles stationary rapid points but accepts elapsed or moved points", () => {
    const previous = { latitude: 10, longitude: 20, capturedAt: new Date("2026-08-28T12:00:00Z") };
    expect(shouldAcceptLocationPoint(previous, { ...previous, capturedAt: new Date("2026-08-28T12:00:05Z") }, 0)).toBe(false);
    expect(shouldAcceptLocationPoint(previous, { ...previous, capturedAt: new Date("2026-08-28T11:59:59Z") }, 50)).toBe(false);
    expect(shouldAcceptLocationPoint(previous, { ...previous, capturedAt: new Date("2026-08-28T12:00:15Z") }, 0)).toBe(true);
    expect(shouldAcceptLocationPoint(previous, { ...previous, capturedAt: new Date("2026-08-28T12:00:05Z") }, 11)).toBe(true);
  });
});
