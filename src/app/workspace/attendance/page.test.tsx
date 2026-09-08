import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getAttendanceOverview: vi.fn(),
  getCurrentAttendance: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/attendance/service", () => ({
  getAttendanceOverview: mocks.getAttendanceOverview,
  getCurrentAttendance: mocks.getCurrentAttendance,
}));

import AttendancePage from "./page";

describe("attendance page overview authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAttendanceOverview.mockResolvedValue([]);
    mocks.getCurrentAttendance.mockResolvedValue(null);
  });

  it("loads the company overview for an Additional Admin despite its legacy FIELD_ADMIN role", async () => {
    mocks.requirePermission.mockResolvedValue({
      id: "additional-admin",
      role: "FIELD_ADMIN",
      salesRole: "ADMIN",
      managerType: null,
    });

    await AttendancePage();

    expect(mocks.getAttendanceOverview).toHaveBeenCalledOnce();
    expect(mocks.getCurrentAttendance).not.toHaveBeenCalled();
  });

  it("does not load a supervisory overview for Sales", async () => {
    mocks.requirePermission.mockResolvedValue({
      id: "sales",
      role: "SALES",
      salesRole: "SALES",
      managerType: null,
    });

    await AttendancePage();

    expect(mocks.getAttendanceOverview).not.toHaveBeenCalled();
    expect(mocks.getCurrentAttendance).toHaveBeenCalledOnce();
  });
});
