import { it, expect, vi, beforeEach } from "vitest";
import { AuthorizationError } from "@/lib/auth/authorization";
const m = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock("@/lib/account/expenses", () => ({
  downloadExpenseAttachment: m.download,
}));
import { GET } from "./route";
const call = () =>
  GET(new Request("http://localhost/api/expense-attachments/id"), {
    params: Promise.resolve({ id: "id" }),
  });
beforeEach(() => vi.clearAllMocks());
it("returns a private protected attachment with a safe Unicode filename", async () => {
  m.download.mockResolvedValue({
    data: Buffer.from("file"),
    name: "receipt №1.pdf",
    mimeType: "application/pdf",
  });
  const r = await call();
  expect(r.status).toBe(200);
  expect(r.headers.get("content-disposition")).toBe(
    "attachment; filename*=UTF-8''receipt%20%E2%84%961.pdf",
  );
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(await r.text()).toBe("file");
});
it("denies foreign attachments without exposing storage keys", async () => {
  m.download.mockRejectedValue(new AuthorizationError());
  const r = await call();
  expect(r.status).toBe(403);
  expect(await r.json()).toEqual({ error: "Attachment access denied." });
});
it("keeps storage failures recoverable and private", async () => {
  m.download.mockRejectedValue(new Error("private/storage/secret"));
  const r = await call();
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("secret");
});
