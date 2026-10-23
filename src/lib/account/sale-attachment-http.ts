import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AuthenticationError, AuthorizationError } from "@/lib/auth/authorization";
import { commercialActionFailure } from "./commercial-action-errors";
import { boundedPrivateDocumentMultipart } from "./private-document-multipart";
import { SaleAttachmentError } from "./sale-attachments";

export const saleAttachmentJson = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function saleCreationAttachmentForm(request: Request) {
  const form = await boundedPrivateDocumentMultipart(request, () => new SaleAttachmentError("INVALID_SALE_ATTACHMENT"));
  const files = form.getAll("attachments");
  if (files.some(file => !(file instanceof File))) throw new SaleAttachmentError("INVALID_SALE_ATTACHMENT");
  let document: unknown, payment: unknown;
  try { document = JSON.parse(String(form.get("document"))); payment = JSON.parse(String(form.get("payment") ?? "{}")); }
  catch { throw new Error("INVALID_INPUT"); }
  if (!document || typeof document !== "object" || Array.isArray(document) || !payment || typeof payment !== "object" || Array.isArray(payment)) throw new Error("INVALID_INPUT");
  return { document, payment, files: files as File[] };
}
export async function saleAppendAttachmentForm(request:Request){
  const form=await boundedPrivateDocumentMultipart(request,()=>new SaleAttachmentError("INVALID_SALE_ATTACHMENT")),files=form.getAll("attachments");
  if(files.some(file=>!(file instanceof File)))throw new SaleAttachmentError("INVALID_SALE_ATTACHMENT");
  return {requestKey:String(form.get("requestKey")??""),files:files as File[]};
}
export function saleAttachmentFailure(error: unknown) {
  if (isRedirectError(error)) throw error;
  const message = error instanceof Error ? error.message : "";
  if (error instanceof AuthenticationError || message === "MOBILE_UNAUTHORIZED") return saleAttachmentJson({ error: "UNAUTHORIZED" }, 401);
  if (error instanceof AuthorizationError || ["MOBILE_FORBIDDEN", "NOT_AUTHORIZED", "Not authorized", "UNTRUSTED_ORIGIN"].includes(message) || message.startsWith("MODULE_DISABLED:")) return saleAttachmentJson({ error: "FORBIDDEN" }, 403);
  if (message === "SUBSCRIPTION_REQUIRED") return saleAttachmentJson({ error: message }, 403);
  if (message === "RATE_LIMITED") return saleAttachmentJson({ error: message }, 429);
  if (message === "SALE_ATTACHMENT_CORRUPT") return saleAttachmentJson({ error: "ATTACHMENT_UNAVAILABLE" }, 503);
  if (message === "INVALID_INPUT") return saleAttachmentJson({ error: "INVALID_INPUT" }, 400);
  const result = commercialActionFailure(error);
  if (message === "IDEMPOTENCY_KEY_REUSED") return saleAttachmentJson(result, 409);
  if (["SALE_ALREADY_REVISED","SALE_RETURN_LINE_HISTORY_REQUIRED","SALE_RETURN_HISTORY_INCONSISTENT","SALE_STOCK_SOURCE_HISTORY_REQUIRED","RETURN_REVISION_STOCK_CONFIGURATION_CHANGED","SALE_HAS_PENDING_CHEQUE","SALE_HAS_PAYMENTS_OR_ADJUSTMENTS","SALE_NOT_EDITABLE","SALE_REPLACEMENT_ALREADY_POSTED"].includes(message)) return saleAttachmentJson(result,409);
  if (error instanceof z.ZodError || result.errorCode !== "SAVE_FAILED") {
    return saleAttachmentJson(result, 400);
  }
  return saleAttachmentJson({ error: "ATTACHMENT_UNAVAILABLE", message: "The Sale or attachment could not be saved or retrieved. Try again." }, 503);
}
export function saleAttachmentResponse(file: { data: Buffer; name: string; mimeType: string }) {
  return new Response(new Uint8Array(file.data), { headers: {
    "Content-Type": file.mimeType,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
