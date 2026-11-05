import { AuthorizationError } from "@/lib/auth/authorization";
import { ZodError } from "zod";
export async function readRestoreBody(
  request: Request,
  limit = 128 * 1024 * 1024,
) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new Error("RESTORE_FILE_TOO_LARGE");
  if (!request.body) throw new Error("RESTORE_INVALID_FILE");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("RESTORE_FILE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.byteLength;
  }
  return result;
}
const messages: Record<string, string> = {
  RESTORE_LEGACY_BACKUP_UNSUPPORTED:
    "This older bundle is incomplete for company replacement. Use a provider recovery backup or create a new complete backup with the company owner account.",
  RESTORE_SCHEMA_UNSUPPORTED:
    "The backup belongs to a different application data version. Ask support to validate a recovery migration.",
  RESTORE_INCOMPLETE_BACKUP:
    "The backup is incomplete. No company data was replaced.",
  RESTORE_SCOPE_INVALID: "Select a backup created for this existing company.",
  RESTORE_UNRECOGNIZED_BACKUP:
    "This file does not match a backup generated for this company, or its contents have changed.",
  RESTORE_PRIVATE_FILE_MISSING:
    "A referenced private file is missing. Use the file-inclusive backup or recover the original storage files first.",
  RESTORE_PRIVATE_FILE_CONFLICT:
    "An existing private file differs from its saved copy. Ask support to resolve the conflict before restoring.",
  RESTORE_COMPANY_CHANGED_REVIEW_AGAIN:
    "Company data changed after the preview. Select the backup and review the replacement again.",
  RESTORE_REVIEW_EXPIRED:
    "The restore preview has expired. Select the backup again.",
  RESTORE_COMPANY_CONFIRMATION_REQUIRED:
    "Type the current company name exactly to confirm replacement.",
  RESTORE_IDENTITY_REFERENCE_CONFLICT:
    "Current user access refers to records outside this backup. No data was replaced; review these identity references with support.",
  RESTORE_VERIFICATION_FAILED:
    "The restored data failed integrity verification. All database changes were rolled back.",
  RESTORE_CHECKSUM_MISMATCH:
    "Backup integrity verification failed. Select the original file again.",
  RESTORE_FILE_TOO_LARGE: "Choose a backup no larger than 128 MiB.",
  RESTORE_INVALID_FILE: "Choose a valid SalesPunch360 JSON backup.",
};
export function restoreFailure(error: unknown) {
  if (error instanceof AuthorizationError)
    return Response.json(
      {
        error: "FORBIDDEN",
        message:
          "Company replacement requires the primary company administrator with access to all branches.",
      },
      { status: 403 },
    );
  if (error instanceof SyntaxError)
    return Response.json(
      { error: "RESTORE_INVALID_FILE", message: messages.RESTORE_INVALID_FILE },
      { status: 400 },
    );
  if (error instanceof ZodError)
    return Response.json(
      {
        error: "INVALID_RESTORE_REQUEST",
        message: "Review the restore confirmation details.",
      },
      { status: 400 },
    );
  const code = error instanceof Error ? error.message : "";
  if (messages[code])
    return Response.json(
      { error: code, message: messages[code] },
      {
        status: code === "RESTORE_FILE_TOO_LARGE" ? 413 : 409,
        headers: { "cache-control": "no-store" },
      },
    );
  return Response.json(
    {
      error: "RESTORE_FAILED",
      message:
        "Restore could not complete. No partial database replacement was committed. Contact support with the backup date.",
    },
    { status: 500 },
  );
}
