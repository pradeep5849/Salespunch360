import { ZodError } from "zod";
import { authenticateMobileSalesToken } from "@/lib/mobile/auth";
import { mobileAuthorizationFailure, mobileJson, mobileUnexpected } from "@/lib/mobile/http";
import { mobileCallbackQueue, mobileLeadCallHistory, mobileRecordLeadCall, mobileSalesActions, mobileTelecallingQueue, mobileUpdateSalesAction } from "@/lib/mobile/telecalling";

function fail(error: unknown) {
  const auth = mobileAuthorizationFailure(error);
  if (auth) return auth;
  const message = error instanceof Error ? error.message : "";
  if (message === "MOBILE_UNAUTHORIZED") return mobileJson({ error: "UNAUTHORIZED" }, 401);
  if (message === "MOBILE_FORBIDDEN" || message === "NOT_AUTHORIZED") return mobileJson({ error: "FORBIDDEN" }, 403);
  if (message === "NOT_FOUND") return mobileJson({ error: "NOT_FOUND" }, 404);
  if (message === "SUBSCRIPTION_REQUIRED" || message === "TELECALLER_SUBSCRIPTION_REQUIRED") return mobileJson({ error: message }, 409);
  if (["INVALID_INPUT", "INVALID_CALL_RESULT", "CALLBACK_DATE_REQUIRED", "CALLBACK_DATE_MUST_BE_FUTURE", "INVALID_DATE", "INVALID_STATUS"].includes(message) || error instanceof SyntaxError || error instanceof ZodError) return mobileJson({ error: message || "INVALID_INPUT" }, 400);
  return mobileUnexpected("MOBILE_TELECALLING", error);
}

export async function GET(request: Request) {
  try {
    const actor = await authenticateMobileSalesToken(request.headers.get("authorization"));
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "queue";
    if (view === "history") {
      const leadId = url.searchParams.get("leadId") ?? "";
      return mobileJson(await mobileLeadCallHistory(actor, leadId));
    }
    if (view === "callbacks") return mobileJson(await mobileCallbackQueue(actor));
    if (view === "sales-actions") return mobileJson(await mobileSalesActions(actor));
    if (view === "queue") return mobileJson(await mobileTelecallingQueue(actor, url.searchParams.get("q") ?? undefined));
    return mobileJson({ error: "INVALID_VIEW" }, 400);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await authenticateMobileSalesToken(request.headers.get("authorization"));
    const body = await request.json() as Record<string, unknown>;
    const action = body.action;
    if (action === "RECORD_CALL") return mobileJson(await mobileRecordLeadCall(actor, body), 201);
    if (action === "UPDATE_SALES_ACTION") return mobileJson(await mobileUpdateSalesAction(actor, body));
    return mobileJson({ error: "INVALID_ACTION" }, 400);
  } catch (error) {
    return fail(error);
  }
}
