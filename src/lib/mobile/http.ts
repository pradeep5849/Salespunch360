import { ZodError } from "zod";
import {
  accountErrorMessage,
  isAccountDomainError,
} from "@/lib/account/action-feedback";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { logEvent } from "@/lib/logging";
import { OperationalBranchError } from "@/lib/branches/operational-scope";
import { AuthorizationError } from "@/lib/auth/authorization";
export const mobileJson = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const mobileError = (status = 401) =>
  mobileJson(
    {
      error:
        status === 429
          ? "Too many attempts. Try again later."
          : "Unable to complete request.",
    },
    status,
  );

export const mobileUnauthorized = (error: unknown) =>
  error instanceof Error && error.message === "MOBILE_UNAUTHORIZED"
    ? mobileJson({ error: "UNAUTHORIZED" }, 401)
    : error instanceof Error && error.message === "MOBILE_FORBIDDEN"
      ? mobileJson({ error: "FORBIDDEN" }, 403)
      : null;
export const mobileBranchFailure = (error: unknown) =>
  error instanceof OperationalBranchError
    ? mobileJson(
        { error: error.code },
        error.code === "BRANCH_REQUIRED" ? 400 : 403,
      )
    : null;
export const mobileAuthorizationFailure = (error: unknown) =>
  error instanceof AuthorizationError ||
  (error instanceof Error &&
    (error.message === "NOT_AUTHORIZED" ||
      error.message === "Not authorized" ||
      error.message.startsWith("MODULE_DISABLED:")))
    ? mobileJson({ error: "FORBIDDEN" }, 403)
    : null;
export function mobileUnexpected(category: string, error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError)
    return mobileJson({ error: "INVALID_INPUT" }, 400);
  if (isAccountDomainError(error))
    return mobileJson(
      { error: error.message, message: accountErrorMessage(error) },
      [
        "IDEMPOTENCY_KEY_REUSED",
        "INVALID_EXPENSE_TRANSITION",
        "EXPENSE_NOT_EDITABLE",
        "CATEGORY_MAPPING_CHANGED_RESUBMIT",
        "RETURN_ASSET_FIRST",
        "ASSET_NOT_ASSIGNED",
        "ASSET_NOT_ASSIGNABLE",
      ].includes(error.message)
        ? 409
        : 400,
    );
  const referenceId = randomUUID(),
    code =
      typeof error === "object" &&
      error &&
      "code" in error &&
      typeof error.code === "string" &&
      /^P\d{4}$/.test(error.code)
        ? error.code
        : undefined;
  logEvent("error", { category, correlationId: referenceId, code });
  return mobileJson({ error: "SERVER_ERROR", referenceId }, 500);
}
