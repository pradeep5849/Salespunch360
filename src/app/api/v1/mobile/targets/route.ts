import { authenticateMobileSalesToken } from "@/lib/mobile/auth";
import { mobileReportActor } from "@/lib/mobile/report-actor";
import { createTargetForActor, editTargetForActor, listTargetsForActor } from "@/lib/targets/service";
import { mobileAuthorizationFailure, mobileBranchFailure, mobileJson, mobileUnauthorized, mobileUnexpected } from "@/lib/mobile/http";
import { ZodError } from "zod";

const actor = async (request: Request) => mobileReportActor(await authenticateMobileSalesToken(request.headers.get("authorization")));
function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const expected = mobileUnauthorized(error) ?? mobileAuthorizationFailure(error) ?? mobileBranchFailure(error);
  if (expected) return expected;
  if (["STALE", "SUBSCRIPTION_REQUIRED"].includes(code)) return mobileJson({ error: code }, 409);
  if (["INVALID_INPUT", "INVALID_TARGET", "INVALID_ASSIGNEE"].includes(code)) return mobileJson({ error: code }, 400);
  if (["INVALID_PERIOD", "NON_CANONICAL_PERIOD"].includes(code)) return mobileJson({ error: "INVALID_TARGET" }, 400);
  if (error instanceof SyntaxError || error instanceof ZodError) return mobileJson({ error: "INVALID_INPUT" }, 400);
  return mobileUnexpected("MOBILE_TARGETS", error);
}
export async function GET(request: Request) {
  try { const url = new URL(request.url); return mobileJson(await listTargetsForActor(await actor(request),Object.fromEntries(url.searchParams))); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try { const a=await actor(request); await createTargetForActor(a,await request.json()); return mobileJson(await listTargetsForActor(a),201); }
  catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try { const a=await actor(request); await editTargetForActor(a,await request.json()); return mobileJson(await listTargetsForActor(a)); }
  catch (error) { return failure(error); }
}
