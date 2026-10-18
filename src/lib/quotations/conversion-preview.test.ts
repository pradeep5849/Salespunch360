import {beforeEach, describe, expect, it, vi} from "vitest";
import {Prisma} from "@prisma/client";
const m = vi.hoisted(() => ({read: vi.fn(), modules: vi.fn(), auth: vi.fn()}));
vi.mock("./service", () => ({getQuotationForActor: m.read}));
vi.mock("@/lib/account/modules", () => ({requireAccountModules: m.modules}));
vi.mock("@/lib/auth/authorization", () => ({requirePermission: m.auth, AuthorizationError: class extends Error {}}));
import {quotationConversionPreview, quotationConversionPreviewForActor} from "./conversion-preview";
const ID = "11111111-1111-4111-8111-111111111111", REV = "22222222-2222-4222-8222-222222222222";
const actor = {id: "actor", name: "Actor", email: "actor@example.test", managerType: null, salesRole: null, salesAccessActive: false, companyId: "company", role: "ACCOUNT_USER", accountRole: "ACCOUNT_ADMIN", isActive: true,
  accountAccessActive: true, branchAccessScope: "ALL_BRANCHES", branchIds: []} as Parameters<typeof quotationConversionPreviewForActor>[0];
const request = {documentId: ID, targetType: "SALES_INVOICE" as const};
const D = (value: string) => new Prisma.Decimal(value);
function source() {
  return {id: ID, companyId: "company", branchId: "branch", customerId: "customer", projectId: "project", documentNumber: "EST-7", status: "APPROVED", currentRevisionNumber: 2,
    revisions: [{id: REV, revisionNumber: 2, customerName: "Buyer", terms: "Agreed terms", inclusions: "Installation", exclusions: null, notes: "Reference only", internalCostTotal: "SECRET", taxableTotal: D("300"), taxTotal: D("54"), grandTotal: D("354"),
      lines: [{lineType: "CUSTOM", itemName: "Work", quantity: D("3"), rate: D("100"), taxRate: D("18"), internalUnitCost: D("60")}],
      adjustments: [], paymentSchedule: [{label: "On completion", amount: D("354"), dueDescription: "On delivery"}]}]};
}
beforeEach(() => {vi.resetAllMocks(); m.read.mockResolvedValue(source()); m.auth.mockResolvedValue(actor);});
describe("A080/A083 read-only conversion preparation", () => {
  it("returns a client-safe exact snapshot and the stable source revision, without creation intent", async () => {
    const result = await quotationConversionPreviewForActor(actor, request);
    expect(result).toMatchObject({sourceDocumentId: ID, sourceRevisionId: REV, sourceRevisionNumber: 2, branchId: "branch", partyId: "customer", projectId: "project", grandTotal: "354.00", reference: {terms: "Agreed terms", paymentSchedule: [{amount: "354.00"}]}});
    expect(JSON.stringify(result)).not.toMatch(/SECRET|internalCost|internalUnitCost|creationRequest|idempotencyKey|journalEntry/);
    expect(m.read).toHaveBeenCalledExactlyOnceWith(actor, ID);
    expect(m.modules).toHaveBeenCalledExactlyOnceWith(actor, "QUOTATIONS_BOQ", "SALES");
  });
  it("preserves long source terms and schedules instead of truncating them into invoice notes", async () => {
    const document = source(); document.revisions[0].terms = "T".repeat(30000); m.read.mockResolvedValue(document);
    const result = await quotationConversionPreviewForActor(actor, request);
    expect(result.reference.terms).toHaveLength(30000); expect(result).not.toHaveProperty("notes");
    expect(result.reference.paymentSchedule[0]).toEqual({label: "On completion", amount: "354.00", dueDescription: "On delivery"});
  });
  it("requires the additional Sales Order module only for the order target", async () => {
    await quotationConversionPreviewForActor(actor, {...request, targetType: "SALES_ORDER"});
    expect(m.modules).toHaveBeenCalledExactlyOnceWith(actor, "QUOTATIONS_BOQ", "SALES", "SALES_ORDER");
  });
  it.each(["QUOTATIONS_BOQ", "SALES", "SALES_ORDER"])("does not read the document when %s is disabled", async module => {
    m.modules.mockRejectedValue(new Error(`MODULE_DISABLED:${module}`));
    await expect(quotationConversionPreviewForActor(actor, {...request, targetType: "SALES_ORDER"})).rejects.toThrow(`MODULE_DISABLED:${module}`);
    expect(m.read).not.toHaveBeenCalled();
  });
  it.each([{isActive: false}, {companyId: null}, {accountAccessActive: false}, {accountRole: "DATA_ENTRY"}, {accountRole: "PROJECT_MANAGER"}])("denies a source reader who cannot post this target: %j", async patch => {
    await expect(quotationConversionPreviewForActor({...actor, ...patch} as typeof actor, request)).rejects.toThrow();
    expect(m.read).not.toHaveBeenCalled();
  });
  it("rejects a foreign company even if a future source-reader refactor returns it", async () => {
    m.read.mockResolvedValue({...source(), companyId: "other-company"});
    await expect(quotationConversionPreviewForActor(actor, request)).rejects.toThrow();
  });
  it("fails closed for a source in an unassigned branch", async () => {
    await expect(quotationConversionPreviewForActor({...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: ["other"]}, request)).rejects.toThrow();
    await expect(quotationConversionPreviewForActor({...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: ["branch"]}, request)).resolves.toMatchObject({branchId: "branch"});
  });
  it("refuses a stale revision selection", async () => {
    await expect(quotationConversionPreviewForActor(actor, {...request, revisionId: ID})).rejects.toThrow("QUOTATION_REVISION_CHANGED");
    m.read.mockResolvedValue({...source(), currentRevisionNumber: 3});
    await expect(quotationConversionPreviewForActor(actor, request)).rejects.toThrow("QUOTATION_REVISION_CHANGED");
  });
  it.each(["taxableTotal", "taxTotal", "grandTotal"] as const)("refuses a saved %s that no longer reconciles", async field => {
    const document = source(); document.revisions[0][field] = D("999"); m.read.mockResolvedValue(document);
    await expect(quotationConversionPreviewForActor(actor, request)).rejects.toThrow("QUOTATION_TOTALS_STALE");
  });
  it("does not create a customer/Project for a lead-only quotation", async () => {
    m.read.mockResolvedValue({...source(), customerId: null});
    await expect(quotationConversionPreviewForActor(actor, request)).rejects.toThrow("QUOTATION_CUSTOMER_REQUIRED");
  });
  it("propagates scoped source not-found errors without an unscoped fallback", async () => {
    m.read.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(quotationConversionPreviewForActor(actor, request)).rejects.toThrow("NOT_FOUND");
    expect(m.read).toHaveBeenCalledTimes(1);
  });
  it.each([{companyId: "forged"}, {branchId: "forged"}, {targetType: "PURCHASE_BILL"}, {documentId: "bad"}])("rejects unsupported or scope-injecting request fields %j", async patch => {
    await expect(quotationConversionPreviewForActor(actor, {...request, ...patch})).rejects.toThrow();
    expect(m.read).not.toHaveBeenCalled();
  });
  it("authenticates the Web reader through the quotation-view boundary", async () => {
    await quotationConversionPreview(request); expect(m.auth).toHaveBeenCalledExactlyOnceWith("ACCOUNT_QUOTATION_VIEW");
  });
});
