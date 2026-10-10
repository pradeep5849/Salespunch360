import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  register: vi.fn(),
  logo: vi.fn(),
  verify: vi.fn(),
  session: vi.fn(),
  bootstrap: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@/lib/auth/registration", () => ({ registerCompany: m.register }));
vi.mock("@/lib/company/logo", () => ({
  MAX_COMPANY_LOGO_BYTES: 5242880,
  processCompanyLogo: m.logo,
}));
vi.mock("@/lib/auth/email-verification", () => ({
  issueEmailVerification: m.verify,
}));
vi.mock("@/lib/mobile/auth", () => ({
  createMobileSession: m.session,
  mobileBootstrap: m.bootstrap,
}));
vi.mock("@/lib/security/request", () => ({
  consumeRateLimit: m.rate,
  requestFingerprint: vi.fn().mockResolvedValue("fixture"),
}));
import { POST } from "./route";
const data = {
  productEdition: "SALESPUNCH360_ACCOUNT",
  companyName: "Logo company",
  adminName: "Company admin",
  adminEmail: "admin@example.test",
  adminPassword: "StrongFixture-123!",
  confirmPassword: "StrongFixture-123!",
  legalConsent: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  m.rate.mockResolvedValue(true);
  m.logo.mockResolvedValue(Buffer.from("processed-webp"));
  m.register.mockResolvedValue({
    user: { id: "user", email: data.adminEmail },
  });
  m.session.mockResolvedValue({
    token: "opaque-token",
    user: { id: "user" },
    expiresAt: new Date(),
  });
  m.bootstrap.mockResolvedValue({ user: { id: "user" } });
});
function multipart() {
  const form = new FormData();
  Object.entries(data).forEach(([key, value]) => form.set(key, String(value)));
  form.set(
    "companyLogo",
    new File(["fixture image"], "logo.png", { type: "image/png" }),
  );
  return new Request("https://example.test/api/v1/mobile/auth/register", {
    method: "POST",
    body: form,
  });
}
it("uses the shared validated logo pipeline in the atomic registration operation", async () => {
  const r = await POST(multipart());
  expect(r.status).toBe(201);
  expect(m.logo).toHaveBeenCalledOnce();
  expect(m.register).toHaveBeenCalledWith(
    expect.objectContaining({ adminEmail: data.adminEmail }),
    Buffer.from("processed-webp"),
  );
});
it("invalid images never create a company or session", async () => {
  m.logo.mockRejectedValue(new Error("LOGO_INVALID"));
  const r = await POST(multipart());
  expect(r.status).toBe(400);
  expect(m.register).not.toHaveBeenCalled();
  expect(m.session).not.toHaveBeenCalled();
  expect(await r.json()).toMatchObject({ error: "LOGO_INVALID" });
});
it("retains JSON compatibility when no optional image is selected", async () => {
  const r = await POST(
    new Request("https://example.test/api/v1/mobile/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    }),
  );
  expect(r.status).toBe(201);
  expect(m.logo).not.toHaveBeenCalled();
  expect(m.register).toHaveBeenCalledWith(
    expect.objectContaining({ adminEmail: data.adminEmail }),
  );
});
it("oversized declared uploads are rejected before parsing or persistence", async () => {
  const r = await POST(
    new Request("https://example.test/api/v1/mobile/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=fixture",
        "Content-Length": "6000000",
      },
      body: "invalid",
    }),
  );
  expect(r.status).toBe(413);
  expect(m.register).not.toHaveBeenCalled();
});
