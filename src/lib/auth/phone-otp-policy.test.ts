import { describe, expect, it } from "vitest";
import {
  checkRegistrationOtpSendBudget,
  REGISTRATION_OTP_WINDOW_MS,
} from "./phone-otp-policy";

const at = new Date("2026-11-23T12:00:00.000Z");
const sent = (offsetMs: number) => ({ sentAt: new Date(at.getTime() - offsetMs) });

describe("registration OTP SMS budget", () => {
  it("allows the first SMS and reports one remaining after reservation", () => {
    expect(checkRegistrationOtpSendBudget([], at)).toEqual({
      allowed: true, retryAfterSeconds: 0, remaining: 2,
    });
  });
  it("requires a 60-second cooldown before a second SMS", () => {
    expect(checkRegistrationOtpSendBudget([sent(30_000)], at)).toEqual({
      allowed: false, retryAfterSeconds: 30, remaining: 1,
    });
    expect(checkRegistrationOtpSendBudget([sent(60_000)], at)).toEqual({
      allowed: true, retryAfterSeconds: 0, remaining: 1,
    });
  });
  it("blocks the third SMS until the oldest send exits the rolling window", () => {
    expect(checkRegistrationOtpSendBudget([sent(120_000), sent(60_000)], at)).toEqual({
      allowed: false, retryAfterSeconds: 86_280, remaining: 0,
    });
  });
  it("excludes sends exactly 24 hours old", () => {
    expect(checkRegistrationOtpSendBudget([sent(REGISTRATION_OTP_WINDOW_MS)], at)).toEqual({
      allowed: true, retryAfterSeconds: 0, remaining: 2,
    });
  });
  it("does not count future timestamps", () => {
    expect(checkRegistrationOtpSendBudget([sent(-1_000)], at).allowed).toBe(true);
  });
});
