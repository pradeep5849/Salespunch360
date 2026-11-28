import { beforeEach, expect, it, vi } from "vitest";
import { browserAnalyticsAllowed, claimAndSend } from "./client";
const m = { gtag: vi.fn(), fetch: vi.fn() };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "true");
  vi.stubGlobal("window", {
    location: {
      origin: "https://www.salespunch360.com",
      href: "https://www.salespunch360.com/workspace/billing/success?order=private&email=secret@example.com",
    },
    gtag: m.gtag,
    __sp360GaReady: true,
  });
  vi.stubGlobal("document", { cookie: "sp360_analytics_consent=v1:1:0" });
  vi.stubGlobal("navigator", { doNotTrack: "0", globalPrivacyControl: false });
  vi.stubGlobal("fetch", m.fetch);
  m.fetch.mockResolvedValue(
    Response.json({
      eventName: "purchase",
      params: {
        transaction_id: "opaque",
        value: 10.25,
        currency: "INR",
        ads_eligible: 0,
      },
    }),
  );
});
it("does not call Google or claim API before consent", async () => {
  vi.stubGlobal("document", { cookie: "" });
  await claimAndSend("purchase", "opaque");
  expect(m.fetch).not.toHaveBeenCalled();
  expect(m.gtag).not.toHaveBeenCalled();
});
it("requires the canonical production host and explicit rollout flag", () => {
  expect(browserAnalyticsAllowed()).toBe(true);
  vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "false");
  expect(browserAnalyticsAllowed()).toBe(false);
  vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "true");
  vi.stubGlobal("window", { location: { origin: "https://staging.example" } });
  expect(browserAnalyticsAllowed()).toBe(false);
});
it("does not reserve a conversion if the Google library has not loaded", async () => {
  vi.stubGlobal("window", {
    location: { origin: "https://www.salespunch360.com" },
    __sp360GaReady: false,
    gtag: m.gtag,
  });
  await claimAndSend("purchase", "opaque");
  expect(m.fetch).not.toHaveBeenCalled();
});
it("sends only server-authorized revenue and sanitized page metadata", async () => {
  await claimAndSend("purchase", "opaque");
  expect(m.fetch.mock.calls[0][1].body).toBe(
    JSON.stringify({ eventName: "purchase", orderId: "opaque" }),
  );
  const params = m.gtag.mock.calls[0][2];
  expect(params).toMatchObject({
    value: 10.25,
    transaction_id: "opaque",
    page_location: "https://www.salespunch360.com/workspace/billing/success",
    page_title: "SalesPunch360",
    page_referrer: "",
  });
  expect(JSON.stringify(params)).not.toContain("secret@example.com");
});
it("does not send deduplicated or excluded purchase results", async () => {
  m.fetch.mockResolvedValue(new Response(null, { status: 204 }));
  await claimAndSend("purchase", "opaque");
  expect(m.gtag).not.toHaveBeenCalled();
});
it("rechecks consent after an asynchronous claim response", async () => {
  m.fetch.mockImplementation(async () => {
    vi.stubGlobal("document", { cookie: "sp360_analytics_consent=v1:0:0" });
    return Response.json({ eventName: "purchase", params: { value: 1 } });
  });
  await claimAndSend("purchase", "opaque");
  expect(m.gtag).not.toHaveBeenCalled();
});
it("honors GPC/DNT even when a previous consent cookie grants analytics", async () => {
  vi.stubGlobal("navigator", { doNotTrack: "1" });
  await claimAndSend("purchase", "opaque");
  expect(m.fetch).not.toHaveBeenCalled();
});
it("does not fail application navigation when telemetry fails", async () => {
  m.fetch.mockRejectedValue(new Error("offline"));
  await expect(claimAndSend("purchase", "opaque")).resolves.toBeUndefined();
});
