import { describe, expect, it } from "vitest";
import {
  dashboardPresentation,
  type DashboardPresentationActor,
} from "./dashboard-presentation";
const actor = (
  role: DashboardPresentationActor["role"],
  salesRole: DashboardPresentationActor["salesRole"],
  managerType: DashboardPresentationActor["managerType"] = null,
) => ({ role, salesRole, managerType });
describe("dashboard presentation policy", () => {
  it("gives COMPANY_ADMIN + PRIMARY_ADMIN admin presentation and owner setup", () => {
    const p = dashboardPresentation(actor("COMPANY_ADMIN", "PRIMARY_ADMIN"));
    expect(p).toMatchObject({
      isPrimaryAdmin: true,
      isAdmin: true,
      isSales: false,
      navigation: "ADMIN",
      canAccessLegacyOwnerRoutes: true,
    });
  });
  it("gives FIELD_ADMIN + ADMIN admin presentation and never Sales/self-only behavior", () => {
    const p = dashboardPresentation(actor("FIELD_ADMIN", "ADMIN"));
    expect(p).toMatchObject({
      isAdditionalAdmin: true,
      isAdmin: true,
      isSales: false,
      fieldWorker: false,
      navigation: "ADDITIONAL_ADMIN",
      label: "ADMIN",
    });
  });
  it("retains Manager behavior", () =>
    expect(
      dashboardPresentation(actor("MANAGER", "MANAGER", "MANAGER_ONLY")),
    ).toMatchObject({
      isManager: true,
      isSales: false,
      navigation: "MANAGER",
    }));
  it("retains Sales behavior", () =>
    expect(dashboardPresentation(actor("SALES", "SALES"))).toMatchObject({
      isSales: true,
      fieldWorker: true,
      navigation: "SALES",
    }));
  it("does not classify MANAGER_ONLY as a field worker", () =>
    expect(
      dashboardPresentation(actor("MANAGER", "MANAGER", "MANAGER_ONLY"))
        .fieldWorker,
    ).toBe(false));
  it("classifies FIELD_MANAGER as a field worker", () =>
    expect(
      dashboardPresentation(actor("MANAGER", "MANAGER", "FIELD_MANAGER"))
        .fieldWorker,
    ).toBe(true));
  it("keeps owner/setup behavior exclusive to the compatible Primary Admin identity", () => {
    expect(
      dashboardPresentation(actor("FIELD_ADMIN", "ADMIN"))
        .canAccessLegacyOwnerRoutes,
    ).toBe(false);
    expect(
      dashboardPresentation(actor("COMPANY_ADMIN", "PRIMARY_ADMIN"))
        .canAccessLegacyOwnerRoutes,
    ).toBe(true);
  });
  it("exposes no additional-admin links backed by legacy requireRole authorization", () => {
    const p = dashboardPresentation(actor("FIELD_ADMIN", "ADMIN"));
    expect(p.canAccessLegacyRoleRoutes).toBe(false);
    expect(p.navigationRoutes).toEqual([
      "/workspace",
      "/workspace/attendance",
      "/workspace/customers",
      "/workspace/check-ins",
    ]);
    expect(p.navigationRoutes).not.toEqual(
      expect.arrayContaining([
        "/workspace/employees",
        "/workspace/billing",
        "/workspace/settings",
        "/workspace/leads",
        "/workspace/follow-up-tasks",
        "/workspace/targets",
      ]),
    );
  });
});
