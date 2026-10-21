import { createHash } from "node:crypto";
import { attachmentDisplayName } from "./attachment-name";

export const PRIVATE_DOCUMENT_FILE_LIMIT = 10 * 1024 * 1024;
export const PRIVATE_DOCUMENT_FILE_COUNT = 50;

/** Only passive, downloadable document/image formats are accepted. */
export function validPrivateDocumentFile(bytes: Buffer, mime: string) {
  return bytes.length > 0 && bytes.length <= PRIVATE_DOCUMENT_FILE_LIMIT && (
    mime === "application/pdf" && bytes.subarray(0, 5).toString() === "%PDF-" ||
    mime === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    mime === "image/jpeg" && bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  );
}

export type PreparedPrivateDocumentFile = {
  bytes: Buffer;
  displayName: string;
  mimeType: string;
  contentHash: string;
  sizeBytes: number;
};

/** Memory-only preparation. The caller owns authorization and the explicit Save
 * transaction; this helper never opens storage or writes document metadata. */
export async function preparePrivateDocumentFiles(
  files: File[],
  failure: (kind: "INVALID" | "LIMIT") => Error,
): Promise<PreparedPrivateDocumentFile[]> {
  if (files.length > PRIVATE_DOCUMENT_FILE_COUNT ||
      files.reduce((sum, file) => sum + file.size, 0) > PRIVATE_DOCUMENT_FILE_LIMIT)
    throw failure("LIMIT");
  // Reject the entire declared selection before reading any file bodies.
  for (const file of files)
    if (!Number.isSafeInteger(file.size) || file.size <= 0 ||
        file.size > PRIVATE_DOCUMENT_FILE_LIMIT ||
        !["application/pdf", "image/png", "image/jpeg"].includes(file.type))
      throw failure("INVALID");

  const prepared: PreparedPrivateDocumentFile[] = [];
  let total = 0;
  // Sequential reads bound transient memory for a multi-file Save request.
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    total += bytes.length;
    if (bytes.length !== file.size || !validPrivateDocumentFile(bytes, file.type))
      throw failure("INVALID");
    if (total > PRIVATE_DOCUMENT_FILE_LIMIT) throw failure("LIMIT");
    prepared.push({
      bytes,
      displayName: attachmentDisplayName(file.name),
      mimeType: file.type,
      contentHash: createHash("sha256").update(bytes).digest("hex"),
      sizeBytes: bytes.length,
    });
  }
  return prepared;
}
