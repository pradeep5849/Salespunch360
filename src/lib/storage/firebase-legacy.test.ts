import { describe, expect, it, vi } from "vitest";
import { FirebaseWithHostingerLegacyStorage } from "./index";
import type { PrivateStorage } from "./types";

function mockStorage(): PrivateStorage {
  return {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockRejectedValue(new Error("not found")),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

describe("FirebaseWithHostingerLegacyStorage", () => {
  it("writes new photos only to Firebase", async () => {
    const firebase = mockStorage();
    const hostinger = mockStorage();
    const storage = new FirebaseWithHostingerLegacyStorage(firebase, hostinger);
    const bytes = Buffer.from("new");
    await storage.put("companies/a/photo.webp", bytes);
    expect(firebase.put).toHaveBeenCalledWith("companies/a/photo.webp", bytes);
    expect(hostinger.put).not.toHaveBeenCalled();
  });

  it("reads existing Hostinger photos without migration", async () => {
    const firebase = mockStorage();
    const hostinger = mockStorage();
    vi.mocked(hostinger.get).mockResolvedValue(Buffer.from("legacy"));
    const storage = new FirebaseWithHostingerLegacyStorage(firebase, hostinger);
    await expect(storage.get("companies/a/photo.webp")).resolves.toEqual(Buffer.from("legacy"));
    expect(firebase.get).not.toHaveBeenCalled();
  });

  it("reads new Firebase photos when absent from Hostinger", async () => {
    const firebase = mockStorage();
    const hostinger = mockStorage();
    vi.mocked(firebase.get).mockResolvedValue(Buffer.from("cloud"));
    const storage = new FirebaseWithHostingerLegacyStorage(firebase, hostinger);
    await expect(storage.get("companies/a/photo.webp")).resolves.toEqual(Buffer.from("cloud"));
  });

  it("deletes from both backends for retention cleanup", async () => {
    const firebase = mockStorage();
    const hostinger = mockStorage();
    const storage = new FirebaseWithHostingerLegacyStorage(firebase, hostinger);
    await storage.delete("companies/a/photo.webp");
    expect(firebase.delete).toHaveBeenCalled();
    expect(hostinger.delete).toHaveBeenCalled();
  });

  it("reports cleanup failure if either backend fails", async () => {
    const firebase = mockStorage();
    const hostinger = mockStorage();
    vi.mocked(firebase.delete).mockRejectedValue(new Error("cloud unavailable"));
    const storage = new FirebaseWithHostingerLegacyStorage(firebase, hostinger);
    await expect(storage.delete("companies/a/photo.webp")).rejects.toThrow("PHOTO_STORAGE_UNAVAILABLE");
    expect(hostinger.delete).toHaveBeenCalled();
  });

  it("rejects unsafe object keys before accessing either backend", async () => {
    const firebase = mockStorage();
    const hostinger = mockStorage();
    const storage = new FirebaseWithHostingerLegacyStorage(firebase, hostinger);
    await expect(storage.get("../secret")).rejects.toThrow("INVALID_STORAGE_KEY");
    expect(firebase.get).not.toHaveBeenCalled();
    expect(hostinger.get).not.toHaveBeenCalled();
  });
});
