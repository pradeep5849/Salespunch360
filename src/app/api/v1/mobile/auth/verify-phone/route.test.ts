import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx)),
    authenticateMobileToken: vi.fn(),
    verifyFirebasePhoneProof: vi.fn(),
    consumeRateLimit: vi.fn(),
    requestFingerprint: vi.fn(),
  };
});
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("@/lib/mobile/auth", () => ({ authenticateMobileToken: mocks.authenticateMobileToken }));
vi.mock("@/lib/auth/firebase-phone-verification", () => ({ verifyFirebasePhoneProof: mocks.verifyFirebasePhoneProof }));
vi.mock("@/lib/security/request", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  requestFingerprint: mocks.requestFingerprint,
}));
import { POST } from "./route";

const phone = "+919876543210";
const request = (body: unknown) => new Request("https://example.test/api/v1/mobile/auth/verify-phone", {
  method: "POST",
  headers: { authorization: "Bearer test-mobile-token", "content-type": "application/json" },
  body: JSON.stringify(body),
});
const payload = { phone, idToken: "firebase-id-token" };

describe("mobile first-use phone verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIRST_USE_PHONE_VERIFICATION_ENABLED = "true";
    mocks.authenticateMobileToken.mockResolvedValue({ id: "user-1", companyId: "company-1" });
    mocks.consumeRateLimit.mockResolvedValue(true);
    mocks.requestFingerprint.mockResolvedValue("fingerprint");
    mocks.verifyFirebasePhoneProof.mockResolvedValue({
      firebaseUid: "firebase-1", phoneNumber: phone, verifiedAt: new Date(),
    });
    mocks.tx.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) =>
      where.id ? { companyId: "company-1", phone: null, phoneVerifiedAt: null, firebasePhoneUid: null } : null);
    mocks.tx.user.findFirst.mockResolvedValue(null);
    mocks.tx.user.update.mockResolvedValue({ id: "user-1" });
  });
  it("fails closed while disabled", async () => {
    process.env.FIRST_USE_PHONE_VERIFICATION_ENABLED = "false";
    expect((await POST(request(payload))).status).toBe(503);
    expect(mocks.authenticateMobileToken).not.toHaveBeenCalled();
  });
  it("rejects missing or invalid mobile credentials", async () => {
    mocks.authenticateMobileToken.mockRejectedValue(new Error("MOBILE_UNAUTHORIZED"));
    expect((await POST(request(payload))).status).toBe(401);
    expect(mocks.verifyFirebasePhoneProof).not.toHaveBeenCalled();
  });
  it("rate limits verification attempts", async () => {
    mocks.consumeRateLimit.mockResolvedValue(false);
    expect((await POST(request(payload))).status).toBe(429);
    expect(mocks.verifyFirebasePhoneProof).not.toHaveBeenCalled();
  });
  it("rejects invalid input", async () => {
    expect((await POST(request({ phone: "9876543210", idToken: "token" }))).status).toBe(400);
  });
  it("rejects invalid Firebase proof", async () => {
    mocks.verifyFirebasePhoneProof.mockRejectedValue(new Error("INVALID_PHONE_PROOF"));
    expect((await POST(request(payload))).status).toBe(400);
    expect(mocks.tx.user.update).not.toHaveBeenCalled();
  });
  it("binds the verified phone to the authenticated user", async () => {
    const response = await POST(request(payload));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verified: true });
    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({ phone, firebasePhoneUid: "firebase-1" }),
    });
  });
  it("rejects Firebase identity already owned by someone else", async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ id: "other-user" });
    expect((await POST(request(payload))).status).toBe(409);
    expect(mocks.tx.user.update).not.toHaveBeenCalled();
  });
  it("rejects phone number already verified by someone else", async () => {
    mocks.tx.user.findFirst.mockResolvedValue({ id: "other-user" });
    expect((await POST(request(payload))).status).toBe(409);
    expect(mocks.tx.user.update).not.toHaveBeenCalled();
  });
  it("requires recovery before changing a verified phone", async () => {
    mocks.tx.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) =>
      where.id ? { companyId: "company-1", phone: "+919876543299", phoneVerifiedAt: new Date(), firebasePhoneUid: "firebase-1" } : null);
    expect((await POST(request(payload))).status).toBe(409);
    expect(mocks.tx.user.update).not.toHaveBeenCalled();
  });
});
