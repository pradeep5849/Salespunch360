import { describe, expect, it } from "vitest";
import { DEFAULT_TRIAL_ENTITLEMENTS, TRIAL_DURATION_MS } from "./config";
import { calculateTrialEndsAt, getTrialStatus } from "./status";

describe("trial lifecycle", () => {
  const startedAt = new Date("2026-01-01T00:00:00.000Z");
  const endsAt = calculateTrialEndsAt(startedAt);
  const company = { subscriptionStatus: "TRIAL" as const, trialStartedAt: startedAt, trialEndsAt: endsAt };

  it("calculates an exact 15-day duration", () => {
    expect(endsAt.getTime() - startedAt.getTime()).toBe(TRIAL_DURATION_MS);
  });

  it("calculates remaining days with partial days rounded up", () => {
    expect(getTrialStatus(company, new Date("2026-01-01T12:00:00.000Z")).remainingDays).toBe(15);
    expect(getTrialStatus(company, new Date("2026-01-15T12:00:00.000Z")).remainingDays).toBe(1);
  });

  it("treats the exact end instant as expired regardless of stored TRIAL status", () => {
    const status = getTrialStatus(company, endsAt);
    expect(status.isInTrial).toBe(false);
    expect(status.isTrialExpired).toBe(true);
    expect(status.effectiveStatus).toBe("EXPIRED");
    expect(status.remainingDays).toBe(0);
  });

  it("provides centralized default seat allowances", () => {
    const status = getTrialStatus(company, startedAt);
    expect(DEFAULT_TRIAL_ENTITLEMENTS.companyAdmin).toBe(1);
    expect(status.managerAllowance).toBe(1);
    expect(status.salesAllowance).toBe(5);
  });
});
