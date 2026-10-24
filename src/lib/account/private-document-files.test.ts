import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  PRIVATE_DOCUMENT_FILE_LIMIT,
  preparePrivateDocumentFiles,
  validPrivateDocumentFile,
} from "./private-document-files";

const failure = (kind: "INVALID" | "LIMIT") => new Error(kind);
const pdf = () => new File(["%PDF-1.7\nfixture"], "../private\u0000-plan.pdf", { type: "application/pdf" });

describe("private Sale/quotation document file preparation", () => {
  it("prepares exact bytes, safe display metadata and a server-computed content hash without persistence", async () => {
    const [file] = await preparePrivateDocumentFiles([pdf()], failure);
    expect(file.displayName).toBe("private-plan.pdf");
    expect(file.bytes.toString()).toBe("%PDF-1.7\nfixture");
    expect(file.contentHash).toBe(createHash("sha256").update(file.bytes).digest("hex"));
    expect(file.sizeBytes).toBe(file.bytes.length);
    expect(file).not.toHaveProperty("storageKey");
    expect(file).not.toHaveProperty("documentId");
    expect(await preparePrivateDocumentFiles([], failure)).toEqual([]);
  });

  it.each([
    ["application/pdf", Buffer.from("%PDF-1.7")],
    ["image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])],
    ["image/jpeg", Buffer.from([255, 216, 255, 0])],
  ])("accepts the existing %s signature policy", async (mime, bytes) => {
    expect(validPrivateDocumentFile(bytes, mime)).toBe(true);
    const files = await preparePrivateDocumentFiles([new File([new Uint8Array(bytes)], "image", { type: mime })], failure);
    expect(files[0].bytes).toEqual(bytes);
  });

  it.each([
    ["application/pdf", "not a PDF"],
    ["image/png", "%PDF-1.7"],
    ["image/svg+xml", "<svg/>"] ,
    ["text/html", "<script>bad()</script>"],
    ["application/pdf", ""],
  ])("rejects empty, mismatched or unsupported %s bodies", async (mime, content) => {
    await expect(preparePrivateDocumentFiles([new File([content], "file", { type: mime })], failure)).rejects.toThrow("INVALID");
  });

  it("rejects count and aggregate-size limits before any body is read", async () => {
    const read = vi.fn();
    const declared = (size: number) => ({ size, type: "application/pdf", name: "a.pdf", arrayBuffer: read }) as unknown as File;
    await expect(preparePrivateDocumentFiles(Array.from({ length: 51 }, () => declared(10)), failure)).rejects.toThrow("LIMIT");
    await expect(preparePrivateDocumentFiles([declared(PRIVATE_DOCUMENT_FILE_LIMIT), declared(1)], failure)).rejects.toThrow("LIMIT");
    expect(read).not.toHaveBeenCalled();
  });

  it("validates all declared types before reading an earlier valid body", async () => {
    const valid = pdf(), read = vi.spyOn(valid, "arrayBuffer");
    await expect(preparePrivateDocumentFiles([valid, new File(["<svg/>"], "x.svg", { type: "image/svg+xml" })], failure)).rejects.toThrow("INVALID");
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects mismatched actual length and does not read subsequent bodies", async () => {
    const next = pdf(), read = vi.spyOn(next, "arrayBuffer");
    const invalid = { size: 5, type: "application/pdf", name: "fake.pdf", arrayBuffer: async () => new TextEncoder().encode("%PDF-1.7").buffer } as File;
    await expect(preparePrivateDocumentFiles([invalid, next], failure)).rejects.toThrow("INVALID");
    expect(read).not.toHaveBeenCalled();
  });
});
