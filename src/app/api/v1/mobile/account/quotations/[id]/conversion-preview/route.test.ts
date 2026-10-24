import {beforeEach, describe, expect, it, vi} from "vitest";
import {AuthorizationError} from "@/lib/auth/authorization";
const m = vi.hoisted(() => ({auth: vi.fn(), actor: vi.fn(), preview: vi.fn()}));
vi.mock("@/lib/mobile/auth", () => ({authenticateMobileToken: m.auth}));
vi.mock("@/lib/mobile/account-transactions", () => ({mobileAccountActor: m.actor}));
vi.mock("@/lib/quotations/conversion-preview", () => ({quotationConversionPreviewForActor: m.preview}));
import {GET} from "./route";
const ID = "11111111-1111-4111-8111-111111111111", REV = "22222222-2222-4222-8222-222222222222";
const context = {params: Promise.resolve({id: ID})};
const request = (query = "targetType=SALES_INVOICE") => new Request(`https://app.invalid/api/quotations/${ID}/conversion-preview?${query}`, {headers: {authorization: "Bearer test"}});
beforeEach(() => {vi.resetAllMocks(); m.auth.mockResolvedValue({id: "user"}); m.actor.mockReturnValue({id: "actor", companyId: "company"}); m.preview.mockResolvedValue({sourceRevisionId: REV, grandTotal: "354.00"});});
describe("A080/A083 native conversion prefill GET", () => {
  it("authenticates, uses route-owned identity and returns private no-store preparation", async () => {
    const result = await GET(request(`targetType=SALES_ORDER&revisionId=${REV}`), context);
    expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.json()).toEqual({sourceRevisionId: REV, grandTotal: "354.00"});
    expect(m.auth).toHaveBeenCalledWith("Bearer test"); expect(m.actor).toHaveBeenCalledWith({id: "user"});
    expect(m.preview).toHaveBeenCalledExactlyOnceWith({id: "actor", companyId: "company"}, {documentId: ID, revisionId: REV, targetType: "SALES_ORDER"});
  });
  it.each(["", "targetType=PURCHASE_BILL", "targetType=SALES_INVOICE&companyId=forged", "targetType=SALES_INVOICE&documentId=forged", "targetType=SALES_ORDER&revisionId=bad"])("rejects unsupported or injected query fields: %s", async query => {
    const result = await GET(request(query), context); expect(result.status).toBe(400); expect(await result.json()).toEqual({error: "INVALID_INPUT"}); expect(m.preview).not.toHaveBeenCalled();
  });
  it("denies unauthenticated callers before reading the source", async () => {
    m.auth.mockRejectedValue(new Error("MOBILE_UNAUTHORIZED")); expect((await GET(request(), context)).status).toBe(401); expect(m.preview).not.toHaveBeenCalled();
  });
  it.each([new AuthorizationError(), new Error("MOBILE_FORBIDDEN"), new Error("MODULE_DISABLED:SALES_ORDER")])("returns forbidden for role/module denial", async error => {
    m.preview.mockRejectedValue(error); expect((await GET(request(), context)).status).toBe(403);
  });
  it.each([["QUOTATION_APPROVAL_REQUIRED", 409], ["NOT_FOUND", 404], ["QUOTATION_REVISION_CHANGED", 409], ["QUOTATION_TOTALS_STALE", 409], ["QUOTATION_CUSTOMER_REQUIRED", 400], ["CONVERSION_TOTAL_MISMATCH", 400], ["CONVERSION_LINE_LIMIT_EXCEEDED", 400]])("maps %s to controlled HTTP %s", async (code, status) => {
    m.preview.mockRejectedValue(new Error(code as string)); const result = await GET(request(), context); expect(result.status).toBe(status); expect(await result.json()).toEqual({error: code});
  });
});
