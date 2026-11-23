import { describe, expect, it, vi, beforeEach } from "vitest";

const { save, download, remove, exists, file, bucket, getStorage, initializeApp, getApps, cert } = vi.hoisted(() => {
  const save = vi.fn();
  const download = vi.fn();
  const remove = vi.fn();
  const exists = vi.fn();
  const file = vi.fn(() => ({ save, download, delete: remove, exists }));
  const bucket = vi.fn(() => ({ file }));
  const getStorage = vi.fn(() => ({ bucket }));
  const initializeApp = vi.fn(() => ({ name: "salespunch360-checkin-storage" }));
  const getApps = vi.fn(() => []);
  const cert = vi.fn((value) => value);
  return { save, download, remove, exists, file, bucket, getStorage, initializeApp, getApps, cert };
});

vi.mock("firebase-admin/app", () => ({ cert, initializeApp, getApps }));
vi.mock("firebase-admin/storage", () => ({ getStorage }));

import { FirebaseStorage } from "./firebase";

describe("FirebaseStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIREBASE_PROJECT_ID = "test-project";
    process.env.FIREBASE_CLIENT_EMAIL = "test@example.com";
    process.env.FIREBASE_PRIVATE_KEY = "test-key";
    process.env.FIREBASE_STORAGE_BUCKET = "test-bucket";
  });

  it("uploads private WebP objects and reads them back", async () => {
    const storage = new FirebaseStorage();
    const bytes = Buffer.from("photo");
    download.mockResolvedValue([bytes]);
    await storage.put("companies/test/check-ins/visit/photo.webp", bytes);
    expect(save).toHaveBeenCalledWith(bytes, expect.objectContaining({
      resumable: false,
      contentType: "image/webp",
    }));
    await expect(storage.get("companies/test/check-ins/visit/photo.webp")).resolves.toEqual(bytes);
    expect(bucket).toHaveBeenCalled();
  });

  it("checks existence and supports idempotent deletion", async () => {
    const storage = new FirebaseStorage();
    exists.mockResolvedValue([true]);
    await expect(storage.exists("companies/test/photo.webp")).resolves.toBe(true);
    await storage.delete("companies/test/photo.webp");
    expect(remove).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it("rejects unsafe keys without calling cloud storage", async () => {
    const storage = new FirebaseStorage();
    await expect(storage.put("../private", Buffer.from("x"))).rejects.toThrow("INVALID_STORAGE_KEY");
    await expect(storage.get("/absolute")).rejects.toThrow("INVALID_STORAGE_KEY");
    expect(file).not.toHaveBeenCalled();
  });

  it("does not expose underlying cloud errors", async () => {
    const storage = new FirebaseStorage();
    download.mockRejectedValue(new Error("sensitive cloud response"));
    await expect(storage.get("companies/test/photo.webp")).rejects.toThrow("PHOTO_STORAGE_UNAVAILABLE");
  });
});
