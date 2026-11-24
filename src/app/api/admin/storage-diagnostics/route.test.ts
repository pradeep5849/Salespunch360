import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedUser, diagnose } = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  diagnose: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getAuthenticatedUser }));
vi.mock("@/lib/storage/firebase", () => ({
  FirebaseStorage: class { diagnose = diagnose; },
}));

import { GET } from "./route";

describe("GET /api/admin/storage-diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STORAGE_DRIVER = "firebase";
    process.env.FIREBASE_PROJECT_ID = "project";
    process.env.FIREBASE_CLIENT_EMAIL = "service@example.com";
    process.env.FIREBASE_PRIVATE_KEY = "private-test-value";
    process.env.FIREBASE_STORAGE_BUCKET = "bucket";
  });

  it("requires authentication", async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(diagnose).not.toHaveBeenCalled();
  });

  it("blocks tenant users even when they are admins", async () => {
    getAuthenticatedUser.mockResolvedValue({ role: "ADMIN", companyId: "tenant" });
    expect((await GET()).status).toBe(403);
    expect(diagnose).not.toHaveBeenCalled();
  });

  it("blocks super-admin identities attached to a tenant", async () => {
    getAuthenticatedUser.mockResolvedValue({ role: "SUPER_ADMIN", companyId: "tenant" });
    expect((await GET()).status).toBe(403);
    expect(diagnose).not.toHaveBeenCalled();
  });

  it("reports missing configuration without calling Firebase", async () => {
    getAuthenticatedUser.mockResolvedValue({ role: "SUPER_ADMIN", companyId: null });
    delete process.env.FIREBASE_PRIVATE_KEY;
    const response = await GET();
    expect(await response.json()).toEqual({
      driver: "firebase", configured: false, ok: false, category: "CONFIGURATION_MISSING",
    });
    expect(diagnose).not.toHaveBeenCalled();
  });

  it("reports sanitized connectivity results only for platform super-admin", async () => {
    getAuthenticatedUser.mockResolvedValue({ role: "SUPER_ADMIN", companyId: null });
    diagnose.mockResolvedValue({ ok: false, category: "PERMISSION_DENIED" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual({
      driver: "firebase", configured: true, ok: false, category: "PERMISSION_DENIED",
    });
    expect(JSON.stringify(body)).not.toContain("private-test-value");
  });
});
