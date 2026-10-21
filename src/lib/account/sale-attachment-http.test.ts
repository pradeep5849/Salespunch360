import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} }));
import { SaleAttachmentError } from "./sale-attachments";
import { saleAttachmentFailure, saleAttachmentResponse, saleCreationAttachmentForm } from "./sale-attachment-http";
describe("private Sale attachment HTTP boundary", () => {
  it("parses a document, separate payment and files without creating anything", async () => {
    const form = new FormData(); form.set("document", JSON.stringify({ type: "SALES_INVOICE", idempotencyKey: "save-key" })); form.set("payment", JSON.stringify({ receivedAmount: "90" }));
    form.append("attachments", new File(["%PDF-1.7"], "plan.pdf", { type: "application/pdf" }));
    const result = await saleCreationAttachmentForm(new Request("http://example.test/", { method: "POST", body: form }));
    expect(result.document).toEqual({ type: "SALES_INVOICE", idempotencyKey: "save-key" }); expect(result.payment).toEqual({ receivedAmount: "90" }); expect(result.files).toHaveLength(1);
  });
  it("rejects strings in file fields and arrays in document or payment fields", async () => {
    for (const [document, payment, file] of [["{}", "{}", "string"], ["[]", "{}", null], ["{}", "[]", null], ["broken", "{}", null]]) {
      const form = new FormData(); form.set("document", document!); form.set("payment", payment!); if (file) form.set("attachments", file);
      await expect(saleCreationAttachmentForm(new Request("http://example.test/", { method: "POST", body: form }))).rejects.toThrow();
    }
  });
  it("rejects oversized declared lengths before consuming the body", async () => {
    const request = new Request("http://example.test/", { method: "POST", body: "x", headers: { "content-length": String(12 * 1024 * 1024) } });
    await expect(saleCreationAttachmentForm(request)).rejects.toThrow("INVALID_SALE_ATTACHMENT"); expect(request.bodyUsed).toBe(false);
  });
  it("bounds actual bytes and cancels oversized chunked bodies", async () => {
    let canceled = false;
    const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { canceled = true; } });
    await expect(saleCreationAttachmentForm(new Request("http://example.test/", { method: "POST", body, duplex: "half" } as RequestInit))).rejects.toThrow("INVALID_SALE_ATTACHMENT"); expect(canceled).toBe(true);
  });
  it("returns no-store nosniff download headers and encodes unsafe filename characters", async () => {
    const response = saleAttachmentResponse({ data: Buffer.from("%PDF-1.7"), name: "a\r\nb.pdf", mimeType: "application/pdf" });
    expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toContain("a%0D%0Ab.pdf"); expect(await response.text()).toBe("%PDF-1.7");
  });
  it("distinguishes validation, authentication, permission and retry failures without exposing storage errors", async () => {
    for (const [message, status] of [["INVALID_INPUT", 400], ["MOBILE_UNAUTHORIZED", 401], ["MOBILE_FORBIDDEN", 403], ["MODULE_DISABLED:SALES", 403], ["SUBSCRIPTION_REQUIRED", 403], ["RATE_LIMITED", 429], ["IDEMPOTENCY_KEY_REUSED", 409]] as const) expect(saleAttachmentFailure(new Error(message)).status).toBe(status);
    expect(saleAttachmentFailure(new SaleAttachmentError("INVALID_SALE_ATTACHMENT")).status).toBe(400);
    expect(saleAttachmentFailure(new SaleAttachmentError("SALE_ATTACHMENT_CORRUPT")).status).toBe(503);
    const response = saleAttachmentFailure(new Error("private-storage-secret")); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private-storage-secret");
  });
});
