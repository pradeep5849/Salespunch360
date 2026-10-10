import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@/lib/logging", () => ({ logEvent: mocks.log }));
import { mobileUnexpected } from "./http";

describe("production-safe mobile failures", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns a correlation reference without exposing unexpected details", async () => {
    const response = mobileUnexpected(
      "MOBILE_TEST",
      new Error("postgresql://user:secret@private/db SQL failed"),
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ error: "SERVER_ERROR" });
    expect(body.referenceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(body)).not.toContain("postgresql");
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("secret");
    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({
        category: "MOBILE_TEST",
        correlationId: body.referenceId,
      }),
    );
  });
  it("logs only a recognized Prisma code", async () => {
    mobileUnexpected("MOBILE_TEST", {
      code: "P2024",
      message: "database host",
    });
    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({ code: "P2024" }),
    );
  });
});

it("returns safe Account domain failures as actionable 400/409 instead of server failures", async () => {
  const invalid = mobileUnexpected(
    "MOBILE_ASSET",
    new Error("OPENING_VALUE_MISMATCH"),
  );
  expect(invalid.status).toBe(400);
  expect(await invalid.json()).toMatchObject({
    error: "OPENING_VALUE_MISMATCH",
    message: expect.stringContaining("Opening quantity"),
  });
  const stale = mobileUnexpected(
    "MOBILE_ASSET",
    new Error("RETURN_ASSET_FIRST"),
  );
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({ error: "RETURN_ASSET_FIRST" });
});
