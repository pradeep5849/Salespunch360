import { describe, expect, it } from "vitest";
import { commercialDomainMessage } from "@/lib/account/commercial-action-errors";
import { mobileUnexpected } from "./http";

describe("plain mobile sale correction feedback", () => {
  it.each([
    ["SALE_ALREADY_REVISED", 409],
    ["SALE_STOCK_COST_HISTORY_INCONSISTENT", 409],
    ["SALE_RETURN_HISTORY_INCONSISTENT", 409],
    ["SALE_MUST_COVER_POSTED_RETURNS", 400],
    ["RETURN_REVISION_ITEM_UNIT_MISMATCH", 400],
    ["RETURN_REVISION_PARTY_PROJECT_MISMATCH", 400],
  ])("returns actionable feedback for %s", async (code, status) => {
    const response = mobileUnexpected("MOBILE_ACCOUNT_SALES_EDIT", new Error(code));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code, message: commercialDomainMessage(code) });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("does not recognize inherited object properties as domain errors", () => {
    expect(commercialDomainMessage("toString")).toBeUndefined();
    expect(commercialDomainMessage("constructor")).toBeUndefined();
  });
});
