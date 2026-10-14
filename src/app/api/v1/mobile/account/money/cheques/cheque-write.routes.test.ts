import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  create: vi.fn(),
  action: vi.fn(),
  source: vi.fn(),
  log: vi.fn(),
}));
vi.mock("@/lib/mobile/auth", () => ({ authenticateMobileToken: mocks.auth }));
vi.mock("@/lib/mobile/account-money", () => ({
  mobileCreateCheque: mocks.create,
  mobileChequeFinancialAction: mocks.action,
  mobileChequePage: vi.fn(),
  mobileCompleteLegacyChequeSource: mocks.source,
}));
vi.mock("@/lib/logging", () => ({ logEvent: mocks.log }));
import { POST as create } from "./route";
import { POST as action } from "./[id]/action/route";
import { POST as source } from "./[id]/source/route";
const id = "00000000-0000-4000-8000-000000000001";
const request = (body: unknown) =>
  new Request("http://localhost/api/v1/mobile/account/money/cheques", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
describe("cheque mutation API boundaries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ id });
  });
  it("forwards authenticated create and versioned actions without dropping retry identity", async () => {
    const input = {
      action: "CLOSE",
      requestKey: id,
      expectedVersion: 2,
      actionDate: "2026-10-12",
    };
    mocks.create.mockResolvedValue({ id });
    mocks.action.mockResolvedValue({ id, status: "CLEARED" });
    expect((await create(request(input))).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({ id }, input);
    expect(
      (await action(request(input), { params: Promise.resolve({ id }) }))
        .status,
    ).toBe(200);
    expect(mocks.action).toHaveBeenCalledWith({ id }, id, input);
  });
  it("rejects unauthenticated requests before writes", async () => {
    mocks.auth.mockRejectedValue(new Error("MOBILE_UNAUTHORIZED"));
    expect((await create(request({}))).status).toBe(401);
    expect(
      (await action(request({}), { params: Promise.resolve({ id }) })).status,
    ).toBe(401);
    expect(
      (await source(request({}), { params: Promise.resolve({ id }) })).status,
    ).toBe(401);
    expect(mocks.source).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.action).not.toHaveBeenCalled();
  });
  it("returns conflict for a stale financial version and denies unauthorized actors", async () => {
    mocks.action.mockRejectedValueOnce(new Error("CHEQUE_CHANGED"));
    expect(
      (await action(request({}), { params: Promise.resolve({ id }) })).status,
    ).toBe(409);
    mocks.action.mockRejectedValueOnce(new Error("MOBILE_FORBIDDEN"));
    expect(
      (await action(request({}), { params: Promise.resolve({ id }) })).status,
    ).toBe(403);
  });
  it("preserves legacy source identity and returns changed-source conflicts", async () => {
    const input = {
      requestKey: id,
      expectedVersion: 0,
      partyId: id,
      amount: "100.00",
    };
    mocks.source.mockResolvedValueOnce({ id });
    expect(
      (await source(request(input), { params: Promise.resolve({ id }) }))
        .status,
    ).toBe(200);
    expect(mocks.source).toHaveBeenCalledWith({ id }, id, input);
    mocks.source.mockRejectedValueOnce(new Error("IDEMPOTENCY_KEY_REUSED"));
    expect(
      (await source(request(input), { params: Promise.resolve({ id }) }))
        .status,
    ).toBe(409);
  });
  it("does not expose server exception content", async () => {
    mocks.create.mockRejectedValue(new Error("private database exception"));
    const result = await create(request({}));
    expect(result.status).toBe(500);
    expect(JSON.stringify(await result.json())).not.toContain(
      "private database exception",
    );
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain(
      "private database exception",
    );
  });
});
