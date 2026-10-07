import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  create: vi.fn(),
  apply: vi.fn(),
  remind: vi.fn(),
  status: vi.fn(),
  redirect: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/account/commercial", () => ({
  applyAdvance: m.apply,
  createCommercialDocument: m.create,
  createSettlement: vi.fn(),
  postCommercialDocument: vi.fn(),
  schedulePaymentReminder: m.remind,
  setPaymentReminderStatus: m.status,
}));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import {
  createCommercialDocumentAction,
  applyAdvanceAction,
  reminderStatusAction,
  saveReminderAction,
} from "./commercial";
beforeEach(() => {
  vi.clearAllMocks();
  m.status.mockResolvedValue({ documentId: "d" });
});
describe("commercial actions normal FormData contracts", () => {
  it("applies an advance and redirects using the extracted document", async () => {
    const f = new FormData();
    f.set("advanceId", "a");
    f.set("documentId", "d");
    f.set("amount", "25");
    f.set("applicationDate", "2026-09-11");
    f.set("idempotencyKey", "key-12345");
    f.set("$ACTION_ID_internal", "ignored");
    await applyAdvanceAction(f);
    expect(m.apply).toHaveBeenCalledWith({
      advanceId: "a",
      documentId: "d",
      amount: "25",
      applicationDate: "2026-09-11",
      idempotencyKey: "key-12345",
    });
    expect(m.redirect).toHaveBeenCalledWith(
      "/workspace/account/transactions/d",
    );
  });
  it("creates a reminder and revalidates its document", async () => {
    const f = new FormData();
    f.set("documentId", "d");
    f.set("remindAt", "2026-09-12T10:00");
    f.set("message", "Please pay");
    f.set("$ACTION_ID_internal", "ignored");
    await saveReminderAction(f);
    expect(m.remind).toHaveBeenCalledWith({
      documentId: "d",
      remindAt: "2026-09-12T10:00",
      message: "Please pay",
    });
    expect(m.revalidate).toHaveBeenCalledWith(
      "/workspace/account/transactions/d",
    );
  });
  it.each(["SENT", "DISMISSED"])(
    "passes only reminder id and %s status",
    async (status) => {
      const f = new FormData();
      f.set("id", "r");
      f.set("status", status);
      f.set("extra", "ignored");
      await reminderStatusAction(f);
      expect(m.status).toHaveBeenCalledWith({ id: "r", status });
      expect(m.revalidate).toHaveBeenCalledWith(
        "/workspace/account/transactions/d",
      );
    },
  );
});

describe("client commercial create result", () => {
  it("returns only a serializable success without Decimal or Date objects", async () => {
    m.create.mockResolvedValue({
      id: "document",
      documentNumber: "01",
      total: { toJSON: () => "100" },
      issueDate: new Date(),
    });
    const result = await createCommercialDocumentAction({
      stateOfSupplyCode: "",
    });
    expect(result).toEqual({ ok: true, id: "document", documentNumber: "01" });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(m.create).toHaveBeenCalledWith({ stateOfSupplyCode: undefined });
  });
  it.each([
    "WAREHOUSE_REQUIRED_FOR_INVENTORY",
    "INVALID_INVENTORY_WAREHOUSE",
    "INSUFFICIENT_STOCK",
    "INVALID_FINANCIAL_YEAR",
    "PERIOD_LOCKED",
    "SYSTEM_LEDGER_MISSING:COGS",
    "MODULE_DISABLED:SALES",
    "BATCH_REQUIRED",
    "SERIAL_QUANTITY_MISMATCH",
  ])(
    "returns a safe result for %s and logs the original exception",
    async (code) => {
      const original = new Error(code),
        log = vi.spyOn(console, "error").mockImplementation(() => {});
      m.create.mockRejectedValueOnce(original);
      try {
        const result = await createCommercialDocumentAction({
          type: "SALES_INVOICE",
        });
        expect(result).toMatchObject({
          ok: false,
          errorCode: code.split(":")[0],
        });
        if (result.ok) throw new Error("Unexpected success");
        expect(result.message).not.toContain("Minified React");
        expect(JSON.parse(JSON.stringify(result))).toEqual(result);
        expect(log).toHaveBeenCalledWith(
          "Commercial document create failed",
          expect.any(String),
          original,
        );
      } finally {
        log.mockRestore();
      }
    },
  );
  it("does not disclose unexpected exception text or database details", async () => {
    const original = new Error("private database and customer data"),
      log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.create.mockRejectedValueOnce(original);
    try {
      const result = await createCommercialDocumentAction({});
      expect(result).toMatchObject({ ok: false, errorCode: "SAVE_FAILED" });
      expect(JSON.stringify(result)).not.toContain(original.message);
      expect(log).toHaveBeenCalledWith(
        "Commercial document create failed",
        expect.any(String),
        original,
      );
    } finally {
      log.mockRestore();
    }
  });
});
