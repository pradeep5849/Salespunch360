import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({ name: "salespunch360-phone-verification" })),
}));

vi.mock("firebase-admin/app", () => ({
  cert: vi.fn(() => ({})),
  getApps: mocks.getApps,
  initializeApp: mocks.initializeApp,
}));
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({ verifyIdToken: mocks.verifyIdToken })),
}));

import { verifyFirebasePhoneProof } from "./firebase-phone-verification";

const phone = "+919876543210";
const proof = () => ({
  uid: "firebase-user-1",
  phone_number: phone,
  auth_time: Math.floor(Date.now() / 1000),
  firebase: { sign_in_provider: "phone" },
});

describe("verifyFirebasePhoneProof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIREBASE_PROJECT_ID = "test-project";
    process.env.FIREBASE_CLIENT_EMAIL = "test@example.invalid";
    process.env.FIREBASE_PRIVATE_KEY = "test-key";
    mocks.verifyIdToken.mockResolvedValue(proof());
  });

  it("accepts a recent phone-provider token for the matching number", async () => {
    await expect(verifyFirebasePhoneProof("token", phone)).resolves.toMatchObject({
      firebaseUid: "firebase-user-1",
      phoneNumber: phone,
    });
    expect(mocks.verifyIdToken).toHaveBeenCalledWith("token", true);
  });

  it("rejects a mismatched phone number", async () => {
    await expect(verifyFirebasePhoneProof("token", "+919876543211")).rejects.toThrow("INVALID_PHONE_PROOF");
  });

  it("rejects a token from a non-phone provider", async () => {
    mocks.verifyIdToken.mockResolvedValue({ ...proof(), firebase: { sign_in_provider: "password" } });
    await expect(verifyFirebasePhoneProof("token", phone)).rejects.toThrow("INVALID_PHONE_PROOF");
  });

  it("rejects stale verification", async () => {
    mocks.verifyIdToken.mockResolvedValue({ ...proof(), auth_time: Math.floor(Date.now() / 1000) - 601 });
    await expect(verifyFirebasePhoneProof("token", phone)).rejects.toThrow("INVALID_PHONE_PROOF");
  });

  it("rejects missing and oversized Firebase UIDs before binding identity", async () => {
    for (const uid of ["", "x".repeat(129)]) {
      mocks.verifyIdToken.mockResolvedValue({ ...proof(), uid });
      await expect(verifyFirebasePhoneProof("token", phone)).rejects.toThrow("INVALID_PHONE_PROOF");
    }
  });

  it("rejects invalid E.164 numbers before contacting Firebase", async () => {
    await expect(verifyFirebasePhoneProof("token", "9876543210")).rejects.toThrow("INVALID_PHONE_NUMBER");
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("rejects failed token verification", async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error("expired"));
    await expect(verifyFirebasePhoneProof("token", phone)).rejects.toThrow("INVALID_PHONE_PROOF");
  });
});
