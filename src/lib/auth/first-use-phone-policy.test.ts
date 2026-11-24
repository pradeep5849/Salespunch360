import { describe, expect, it } from "vitest";
import { isFirstUsePhoneGateExemptPath, requiresFirstUsePhoneVerification } from "./first-use-phone-policy";

const employee = {
  role: "EMPLOYEE",
  companyId: "company-1",
  phone: "+919876543210",
  phoneVerifiedAt: null,
};

describe("first-use mobile verification gate", () => {
  it("stays disabled until the complete verification flow is released", () => {
    expect(requiresFirstUsePhoneVerification(employee, false)).toBe(false);
  });

  it("requires verification for an unverified company employee", () => {
    expect(requiresFirstUsePhoneVerification(employee, true)).toBe(true);
  });

  it("requires verification even if an admin provided a phone number", () => {
    expect(requiresFirstUsePhoneVerification({ ...employee, phone: null }, true)).toBe(true);
  });

  it("does not block verified users or platform operators", () => {
    expect(requiresFirstUsePhoneVerification({ ...employee, phoneVerifiedAt: new Date() }, true)).toBe(false);
    expect(requiresFirstUsePhoneVerification({ ...employee, role: "SUPER_ADMIN" }, true)).toBe(false);
    expect(requiresFirstUsePhoneVerification({ ...employee, companyId: null }, true)).toBe(false);
  });

  it("only exempts verification and logout endpoints, not workspace APIs", () => {
    expect(isFirstUsePhoneGateExemptPath("/verify-mobile")).toBe(true);
    expect(isFirstUsePhoneGateExemptPath("/api/auth/phone-otp/reserve")).toBe(true);
    expect(isFirstUsePhoneGateExemptPath("/api/auth/phone-otp/confirm")).toBe(true);
    expect(isFirstUsePhoneGateExemptPath("/api/auth/session-status")).toBe(true);
    expect(isFirstUsePhoneGateExemptPath("/api/auth/phone-otp/confirm/other")).toBe(false);
    expect(isFirstUsePhoneGateExemptPath("/api/v1/mobile/auth/verify-phone")).toBe(true);
    expect(isFirstUsePhoneGateExemptPath("/api/v1/mobile/auth/logout")).toBe(true);
    expect(isFirstUsePhoneGateExemptPath("/workspace")).toBe(false);
    expect(isFirstUsePhoneGateExemptPath("/api/v1/mobile/sales")).toBe(false);
  });
});
