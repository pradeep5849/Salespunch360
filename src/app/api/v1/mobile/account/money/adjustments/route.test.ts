import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/lib/auth/authorization";
import { z } from "zod";
const mock = vi.hoisted(() => ({ auth: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/mobile/auth", () => ({ authenticateMobileToken: mock.auth }));
vi.mock("@/lib/mobile/account-money", () => ({
  mobileMoneyAdjustment: mock.post,
}));
import { POST } from "./route";
describe("mobile money adjustment boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.auth.mockResolvedValue({ id: "actor" });
    mock.post.mockResolvedValue({ id: "journal" });
  });
  const request = () =>
    new Request("https://app.invalid/api", {
      method: "POST",
      headers: {
        authorization: "Bearer test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        idempotencyKey: "retry",
        reason: "Count correction",
      }),
    });
  it("authenticates and forwards posting identity with no-store response", async () => {
    const r = await POST(request());
    expect(r.status).toBe(201);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(mock.post).toHaveBeenCalledWith(
      { id: "actor" },
      { idempotencyKey: "retry", reason: "Count correction" },
    );
  });
  it("rejects unauthenticated and denied writes before successful posting", async () => {
    mock.auth.mockRejectedValueOnce(new Error("MOBILE_UNAUTHORIZED"));
    expect((await POST(request())).status).toBe(401);
    expect(mock.post).not.toHaveBeenCalled();
    mock.post.mockRejectedValueOnce(new AuthorizationError());
    expect((await POST(request())).status).toBe(403);
  });
  it("returns invalid input and retry conflict without a generic success", async () => {
    mock.post.mockRejectedValueOnce(z.object({reason:z.string().min(3)}).safeParse({reason:" "}).error);
    const invalid=await POST(request());
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get("cache-control")).toBe("no-store");
    expect(await invalid.json()).toMatchObject({error:"INVALID_INPUT",message:"Enter a valid reason within the allowed length.",fieldErrors:{reason:"Enter a valid reason within the allowed length."}});
    mock.post.mockRejectedValueOnce(new Error("IDEMPOTENCY_CONFLICT"));
    expect((await POST(request())).status).toBe(409);
  });
});
