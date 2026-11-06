import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  AuthenticationError,
  AuthorizationError,
} from "@/lib/auth/authorization";
import { accountErrorMessage, isAccountDomainError } from "./action-feedback";
import { boundedPrivateDocumentMultipart } from "./private-document-multipart";
export async function paymentEvidenceForm(request: Request) {
  const form = await boundedPrivateDocumentMultipart(
    request,
    () => new Error("INVALID_PAYMENT_ATTACHMENT"),
  );
  const files = form.getAll("attachments");
  if (files.some((file) => !(file instanceof File)))
    throw new Error("INVALID_PAYMENT_ATTACHMENT");
  let input: unknown;
  try {
    input = JSON.parse(String(form.get("payload")));
  } catch {
    throw new Error("INVALID_INPUT");
  }
  return { input, files: files as File[] };
}
export function paymentEvidenceFailure(error: unknown) {
  if (isRedirectError(error)) throw error;
  if (
    error instanceof AuthenticationError ||
    (error instanceof Error && error.message === "MOBILE_UNAUTHORIZED")
  )
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (
    error instanceof AuthorizationError ||
    (error instanceof Error && error.message === "MOBILE_FORBIDDEN")
  )
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return Response.json(
      {
        error: "INVALID_INPUT",
        message: "Check the payment details and attachments.",
      },
      { status: 400 },
    );
  if (isAccountDomainError(error))
    return Response.json(
      { error: error.message, message: accountErrorMessage(error) },
      { status: error.message === "IDEMPOTENCY_KEY_REUSED" ? 409 : 400 },
    );
  return Response.json(
    {
      error: "PAYMENT_EVIDENCE_UNAVAILABLE",
      message:
        "Payment or evidence could not be confirmed. Keep the inputs and retry the same request.",
    },
    { status: 503 },
  );
}
export function paymentEvidenceResponse(file: {
  bytes: Buffer;
  displayName: string;
  mimeType: string;
}) {
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.displayName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
