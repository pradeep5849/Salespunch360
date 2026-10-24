import {z} from "zod";
import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileAccountActor} from "@/lib/mobile/account-transactions";
import {quotationConversionPreviewForActor} from "@/lib/quotations/conversion-preview";
import {mobileAuthorizationFailure, mobileJson, mobileUnauthorized, mobileUnexpected} from "@/lib/mobile/http";
import type {QuotationActor} from "@/lib/quotations/service";
const query = z.object({targetType: z.enum(["SALES_INVOICE", "SALES_ORDER"]), revisionId: z.string().guid().optional()}).strict();
const conflicts = new Set(["QUOTATION_APPROVAL_REQUIRED", "QUOTATION_REVISION_CHANGED", "QUOTATION_TOTALS_STALE"]);
const invalid = new Set(["QUOTATION_CUSTOMER_REQUIRED", "INVALID_QUOTATION_LINE_REFERENCE", "CONVERSION_LINE_LIMIT_EXCEEDED", "CONVERSION_TOTAL_MISMATCH"]);

/** GET prepares an unsaved form only. No target creation or source transition. */
export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    const user = await authenticateMobileToken(request.headers.get("authorization"));
    const selection = query.parse(Object.fromEntries(new URL(request.url).searchParams));
    return mobileJson(await quotationConversionPreviewForActor(mobileAccountActor(user) as QuotationActor, {...selection, documentId: (await context.params).id}));
  } catch (error) {
    const auth = mobileUnauthorized(error) ?? mobileAuthorizationFailure(error);
    if (auth) return auth;
    if (error instanceof z.ZodError) return mobileJson({error: "INVALID_INPUT"}, 400);
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") return mobileJson({error: "NOT_FOUND"}, 404);
      if (conflicts.has(error.message)) return mobileJson({error: error.message}, 409);
      if (invalid.has(error.message)) return mobileJson({error: error.message}, 400);
    }
    return mobileUnexpected("MOBILE_QUOTATION_CONVERSION_PREVIEW", error);
  }
}
