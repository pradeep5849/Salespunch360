import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertTrustedOrigin: vi.fn(),
  consumeRateLimit: vi.fn(),
  requestFingerprint: vi.fn(),
  reservePhoneOtpSend: vi.fn(),
}));
vi.mock("@/lib/security/request", () => ({
  assertTrustedOrigin: mocks.assertTrustedOrigin,
  consumeRateLimit: mocks.consumeRateLimit,
  requestFingerprint: mocks.requestFingerprint,
}));
vi.mock("@/lib/auth/phone-otp-send-budget", () => ({
  reservePhoneOtpSend: mocks.reservePhoneOtpSend,
  PhoneOtpSendLimitError: class PhoneOtpSendLimitError extends Error {
    constructor(public readonly retryAfterSeconds: number) { super("PHONE_OTP_SEND_LIMIT"); }
  },
}));
import { POST } from "./route";
import { PhoneOtpSendLimitError } from "@/lib/auth/phone-otp-send-budget";

const request = (phone: unknown) => new Request("https://example.invalid/api/auth/phone-otp/reserve", {
  method: "POST",
  body: JSON.stringify({ phone }),
  headers: { "Content-Type": "application/json", Origin: "https://example.invalid" },
});

describe("Firebase SMS reservation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PHONE_VERIFICATION_ENABLED = "true";
    mocks.consumeRateLimit.mockResolvedValue(true);
    mocks.requestFingerprint.mockResolvedValue("fingerprint");
    mocks.reservePhoneOtpSend.mockResolvedValue({ remaining: 1 });
  });
  it("fails closed when feature is disabled", async () => {
    process.env.PHONE_VERIFICATION_ENABLED = "false";
    expect((await POST(request("+919876543210"))).status).toBe(503);
    expect(mocks.reservePhoneOtpSend).not.toHaveBeenCalled();
  });
  it("rejects requests missing Origin", async () => {
    const noOrigin = new Request("https://example.invalid/api/auth/phone-otp/reserve", {
      method: "POST", body: JSON.stringify({ phone: "+919876543210" }),
      headers: { "Content-Type": "application/json" },
    });
    expect((await POST(noOrigin)).status).toBe(403);
    expect(mocks.reservePhoneOtpSend).not.toHaveBeenCalled();
  });
  it("rejects an untrusted origin", async () => {
    mocks.assertTrustedOrigin.mockRejectedValue(new Error("UNTRUSTED_ORIGIN"));
    expect((await POST(request("+919876543210"))).status).toBe(403);
  });
  it("rejects invalid numbers without consuming a reservation", async () => {
    expect((await POST(request("9876543210"))).status).toBe(400);
    expect(mocks.reservePhoneOtpSend).not.toHaveBeenCalled();
  });
  it("enforces IP-level rate limiting", async () => {
    mocks.consumeRateLimit.mockResolvedValue(false);
    expect((await POST(request("+919876543210"))).status).toBe(429);
    expect(mocks.reservePhoneOtpSend).not.toHaveBeenCalled();
  });
  it("reserves a valid send", async () => {
    const response = await POST(request("+919876543210"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ allowed: true, remaining: 1 });
    expect(mocks.reservePhoneOtpSend).toHaveBeenCalledWith("+919876543210");
  });
  it("returns retry-after when the phone budget is exhausted", async () => {
    mocks.reservePhoneOtpSend.mockRejectedValue(new PhoneOtpSendLimitError(60));
    const response = await POST(request("+919876543210"));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });
});
