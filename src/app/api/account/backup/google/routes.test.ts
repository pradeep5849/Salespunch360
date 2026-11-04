import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  guard: vi.fn(),
  begin: vi.fn(),
  finish: vi.fn(),
  validate: vi.fn(),
  run: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({
  requirePermissionForMutation: m.auth,
}));
vi.mock("@/lib/env", () => ({
  env: { APP_URL: "https://www.salespunch360.com", NODE_ENV: "production" },
}));
vi.mock("@/lib/security/request", () => ({ mutationGuard: m.guard }));
vi.mock("@/lib/account/google-drive-backup", () => ({
  beginGoogleBackup: m.begin,
  finishGoogleBackup: m.finish,
  validateGoogleBackupState: m.validate,
  GOOGLE_BACKUP_COOKIE: "sp360_google_backup",
}));
vi.mock("@/lib/account/backup-settings", () => ({
  runGoogleDriveBackup: m.run,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: m.get, set: m.set }),
}));
import { POST as connect } from "./connect/route";
import { GET as callback } from "./callback/route";
import { POST as run } from "./run/route";
const actor = {
  id: "admin",
  companyId: "company",
  accountRole: "ACCOUNT_ADMIN",
};
const request = (path = "connect", origin = "https://www.salespunch360.com") =>
  new Request(
    `https://www.salespunch360.com/api/account/backup/google/${path}`,
    { method: "POST", headers: { Origin: origin } },
  );
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue(actor);
  m.run.mockResolvedValue(true);
  m.begin.mockReturnValue({
    url: "https://accounts.google.com/o/oauth2/v2/auth?state=nonce",
    cookie: "encrypted-state",
  });
  m.get.mockReturnValue({ value: "encrypted-state" });
  m.validate.mockReturnValue({ companyId: "company", userId: "admin" });
});
it("rejects missing or foreign Origin before Google authorization starts", async () => {
  expect(
    (await connect(request("connect", "https://foreign.example"))).status,
  ).toBe(403);
  expect(
    (
      await connect(
        new Request(
          "https://www.salespunch360.com/api/account/backup/google/connect",
          { method: "POST" },
        ),
      )
    ).status,
  ).toBe(403);
  expect(m.begin).not.toHaveBeenCalled();
  expect(m.auth).not.toHaveBeenCalled();
});
it("rejects a non-admin and never creates provider state", async () => {
  m.auth.mockResolvedValue({ ...actor, accountRole: "DATA_ENTRY" });
  expect((await connect(request())).status).toBe(403);
  expect(m.begin).not.toHaveBeenCalled();
});
it("binds OAuth startup to the server-authorized company and sets a secure HttpOnly state cookie", async () => {
  const response = await connect(request());
  expect(await response.json()).toEqual({
    url: expect.stringContaining("https://accounts.google.com/"),
  });
  expect(m.begin).toHaveBeenCalledWith("company", "admin");
  expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/);
  expect(response.headers.get("set-cookie")).toMatch(/Secure/);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("consumes state and validates the current actor before exchanging a callback code", async () => {
  const response = await callback(
    new Request(
      "https://www.salespunch360.com/api/account/backup/google/callback?state=nonce&code=one-time-code",
    ),
  );
  expect(m.set).toHaveBeenCalledWith(
    "sp360_google_backup",
    "",
    expect.objectContaining({ maxAge: 0 }),
  );
  expect(m.validate).toHaveBeenCalledWith(
    "encrypted-state",
    "nonce",
    "company",
    "admin",
  );
  expect(m.finish).toHaveBeenCalledWith("one-time-code", {
    companyId: "company",
    userId: "admin",
  });
  expect(response.headers.get("location")).toContain("google=connected");
  expect(response.headers.get("location")).not.toContain("one-time-code");
});
it("does not exchange a code if state validation fails", async () => {
  m.validate.mockImplementation(() => {
    throw new Error("invalid state");
  });
  const response = await callback(
    new Request(
      "https://www.salespunch360.com/api/account/backup/google/callback?state=wrong&code=secret",
    ),
  );
  expect(response.headers.get("location")).toContain("google=failed");
  expect(m.finish).not.toHaveBeenCalled();
});
it("handles cancelled Google consent without changing a connection", async () => {
  const response = await callback(
    new Request(
      "https://www.salespunch360.com/api/account/backup/google/callback?state=nonce&error=access_denied",
    ),
  );
  expect(response.headers.get("location")).toContain("google=cancelled");
  expect(m.finish).not.toHaveBeenCalled();
});
it("requires same-origin administrator authorization for an immediate Drive backup", async () => {
  expect((await run(request("run", "https://foreign.example"))).status).toBe(
    403,
  );
  expect(m.run).not.toHaveBeenCalled();
  const response = await run(request("run"));
  expect(m.run).toHaveBeenCalledWith(actor, expect.any(Date), true);
  expect(response.headers.get("location")).toContain("google=uploaded");
});
it("never claims an unsuccessful upload succeeded or reflects provider secrets", async () => {
  m.run.mockRejectedValue(new Error("provider-secret"));
  const response = await run(request("run"));
  expect(response.headers.get("location")).toContain("google=backup-failed");
  expect(response.headers.get("location")).not.toContain("provider-secret");
});

it("reports an active delivery rather than falsely confirming a second manual upload", async () => {
  m.run.mockResolvedValue(false);
  const response = await run(request("run"));
  expect(response.headers.get("location")).toContain("google=in-progress");
});
