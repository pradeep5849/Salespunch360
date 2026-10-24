import {moneyValidationFeedback} from "./money-validation-feedback";
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
  if(error instanceof ZodError && /^MOBILE_(MONEY|LOAN|OWNER|CHEQUE|ASSET_FUNDING)/.test(category))
    return mobileJson(moneyValidationFeedback(error),400);
  if (error instanceof ZodError || error instanceof SyntaxError)
    return mobileJson({ error: "INVALID_INPUT" }, 400);
  if (isAccountDomainError(error))
    return mobileJson(
      { error: error.message, message: accountErrorMessage(error) },
      [
        "SALE_ALREADY_REVISED",
        "SALE_RETURN_LINE_HISTORY_REQUIRED",
        "SALE_RETURN_HISTORY_INCONSISTENT",
        "SALE_STOCK_SOURCE_HISTORY_REQUIRED",
        "SALE_STOCK_COST_HISTORY_INCONSISTENT",
        "RETURN_REVISION_STOCK_CONFIGURATION_CHANGED",
        "SALE_HAS_PENDING_CHEQUE",
        "SALE_HAS_PAYMENTS_OR_ADJUSTMENTS",
        "SALE_NOT_EDITABLE",
        "SALE_REPLACEMENT_ALREADY_POSTED",
        "OWNER_CORRECTION_ALREADY_POSTED",
        "IDEMPOTENCY_KEY_REUSED",
        "IDEMPOTENCY_CONFLICT",
        "LOAN_CHANGED",
        "QUOTATION_ALREADY_CONVERTED",
        "QUOTATION_APPROVAL_REQUIRED",
        "QUOTATION_REVISION_CHANGED",
        "SALE_PRICE_CHANGED",
        "SALE_PRICE_DOCUMENT_CHANGED",
        "CHEQUE_CHANGED",
        "CHEQUE_NUMBER_EXISTS",
        "INVALID_CHEQUE_SOURCE",
        "EXPENSE_REVIEW_RETRY_CONFLICT",
        "INVALID_EXPENSE_REVIEW_TRANSITION",
        "RECURRING_SCHEDULE_CHANGED",
        "RECURRING_BILL_NOT_PAYABLE",
        "RECURRING_OCCURRENCE_ALREADY_EXISTS",
        "ITEM_IDENTIFIER_EXISTS",
        "BUSINESS_CURRENCY_LOCKED",
        "EXPENSE_CATEGORY_NAME_EXISTS",
        "INVALID_EXPENSE_TRANSITION",
        "INVALID_CHANGE_ORDER_TRANSITION",
        "CHANGE_ORDER_NOT_EDITABLE",
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
