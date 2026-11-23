import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    tx,
    transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx)),
    getAuthenticatedUser: vi.fn(),
    verifyFirebasePhoneProof: vi.fn(),
    assertTrustedOrigin: vi.fn(),
    consumeRateLimit: vi.fn(),
    requestFingerprint: vi.fn(),
  };
});
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("@/lib/auth/session", () => ({ getAuthenticatedUser: mocks.getAuthenticatedUser }));
vi.mock("@/lib/auth/firebase-phone-verification", () => ({
  verifyFirebasePhoneProof: mocks.verifyFirebasePhoneProof,
}));
vi.mock("@/lib/security/request", () => ({
  assertTrustedOrigin: mocks.assertTrustedOrigin,
  consumeRateLimit: mocks.consumeRateLimit,
  requestFingerprint: mocks.requestFingerprint,
}));
import { POST } from "./route";

const phone = "+919876543210";
const req = (body: unknown, origin = "https://example.invalid") =>
  new Request("https://example.invalid/api/auth/phone-otp/confirm", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });

describe("authenticated Firebase phone confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIRST_USE_PHONE_VERIFICATION_ENABLED = "true";
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "EMPLOYEE" });
    mocks.consumeRateLimit.mockResolvedValue(true);
    mocks.requestFingerprint.mockResolvedValue("fingerprint");
    mocks.verifyFirebasePhoneProof.mockResolvedValue({
      firebaseUid: "firebase-1", phoneNumber: phone, verifiedAt: new Date(),
    });
    mocks.tx.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) =>
      where.id ? { id: "user-1", companyId: "company-1", phoneVerifiedAt: null, firebasePhoneUid: null } : null);
    mocks.tx.user.findFirst.mockResolvedValue(null);
    mocks.tx.user.update.mockResolvedValue({ id: "user-1" });
  });
  it("fails closed when disabled", async () => {
    process.env.FIRST_USE_PHONE_VERIFICATION_ENABLED = "false";
    expect((await POST(req({ phone, idToken: "token" }))).status).toBe(503);
  });
  it("requires authentication", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);
    expect((await POST(req({ phone, idToken: "token" }))).status).toBe(401);
  });
  it("rejects malformed phone proofs", async () => {
    expect((await POST(req({ phone: "123", idToken: "token" }))).status).toBe(400);
    expect(mocks.verifyFirebasePhoneProof).not.toHaveBeenCalled();
  });
  it("rejects Firebase verification failures", async () => {
    mocks.verifyFirebasePhoneProof.mockRejectedValue(new Error("INVALID_PHONE_PROOF"));
    expect((await POST(req({ phone, idToken: "token" }))).status).toBe(400);
  });
  it("binds a valid verified identity", async () => {
    const response = await POST(req({ phone, idToken: "token" }));
    expect(response.status).toBe(200);
    expect(mocks.tx.user.update).toHaveBeenCalledOnce();
    expect(mocks.tx.$executeRaw).toHaveBeenCalledTimes(2);
  });
  it("rejects an identity already owned by another user", async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ id: "other-user" });
    expect((await POST(req({ phone, idToken: "token" }))).status).toBe(409);
    expect(mocks.tx.user.update).not.toHaveBeenCalled();
  });
  it("rejects a phone verified by another user even with a different Firebase UID", async () => {
    mocks.tx.user.findFirst.mockResolvedValue({ id: "other-user" });
    expect((await POST(req({ phone, idToken: "token" }))).status).toBe(409);
    expect(mocks.tx.user.update).not.toHaveBeenCalled();
  });
  it("blocks phone identity changes without recovery", async () => {
    mocks.tx.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) =>
      where.id ? { id: "user-1", companyId: "company-1", phoneVerifiedAt: new Date(), firebasePhoneUid: "old-uid" } : null);
    expect((await POST(req({ phone, idToken: "token" }))).status).toBe(409);
  });
});
