import { z } from "zod";
import { AuthorizationError } from "@/lib/auth/authorization";
import { isRedirectError } from "next/dist/client/components/redirect-error";
export type AccountActionResult = {
  kind: "success" | "error";
  message: string;
  redirectTo?: string;
  fieldErrors?: Record<string, string>;
};
const messages: Record<string, string> = {
  UNBALANCED_JOURNAL: "Total debits must equal total credits.",
  INVALID_LEDGER_ACCOUNT: "Select an active posting ledger from this company.",
  INVALID_COST_CENTRE: "Select an active cost centre from this company.",
  PERIOD_UNLOCK_NOT_SUPPORTED:
    "Period locks cannot be cleared or moved backward.",
  INVALID_LOCK_DATE: "Choose a lock date within the financial year.",
  INVALID_DATE_RANGE: "The end date must be on or after the start date.",
  EXPENSE_CATEGORY_NAME_EXISTS:
    "A category with this name already exists. Select it or choose another name.",
  INVALID_INPUT: "Choose a supported action and complete its required fields.",
  INVALID_EXPENSE_ATTACHMENT:
    "Upload a non-empty PDF, JPEG, or PNG no larger than 10 MB.",
  INVALID_REIMBURSEMENT: "Select an approved reimbursement for this branch.",
  INVALID_ASSET_LEDGER:
    "Select an active posting ledger of the required class.",
  INVALID_ASSET_VENDOR: "Select an active vendor from this company.",
  DEPRECIATION_CONFIGURATION_REQUIRED:
    "Enter useful life and depreciation start date.",
  SALVAGE_EXCEEDS_VALUE: "Salvage value cannot exceed purchase value.",
  OPENING_VALUATION_REQUIRED:
    "Enter positive opening quantity, unit price, and effective date together.",
  OPENING_VALUE_MISMATCH:
    "Opening quantity × unit price must equal the effective purchase value.",
  PURCHASE_DOCUMENT_REQUIRED:
    "Select a purchase bill before selecting its line.",
  ASSET_NOT_ASSIGNABLE: "This asset status does not allow assignment.",
  ASSET_NOT_ASSIGNED:
    "This asset has already been returned or is not assigned.",
  RETURN_ASSET_FIRST: "Return the assigned asset before changing its status.",
  ASSET_DISPOSED_TERMINAL: "A disposed asset cannot be reactivated.",
  INVALID_ASSET_STATUS: "Choose a supported asset status.",
  IDEMPOTENCY_KEY_REUSED:
    "This request was already saved with different details. Reload before starting a new entry.",
  INVALID_EXPENSE_AMOUNT:
    "Enter a positive amount within the supported monetary range.",
  INVALID_CATEGORY_LEDGER:
    "Choose an active posting ledger of the required class.",
  CATEGORY_INCOME_LEDGER_REQUIRED:
    "Select a separate income ledger for a BOTH category.",
  EXPENSE_CATEGORY_CLASS_MISMATCH:
    "The selected category no longer matches this transaction type.",
  CATEGORY_MAPPING_CHANGED_RESUBMIT:
    "The category mapping changed. Edit and resubmit this draft before posting.",
  INVALID_MONEY_ACCOUNT:
    "Select an active cash or bank account for this branch.",
  MONEY_ACCOUNT_REQUIRED: "Select a cash or bank account.",
  INVALID_BRANCH: "Select an active branch you can access.",
  PROJECT_REQUIRED: "Select an authorized project.",
  OTHER_INCOME_TAX_REQUIRES_A12:
    "Other Income currently supports non-taxable entries. Set GST and CESS to zero.",
  EXPENSE_NOT_APPROVED: "Submit and approve the expense before posting.",
  INVALID_EXPENSE_TRANSITION:
    "This action is no longer available for the current status.",
  EXPENSE_NOT_REVERSIBLE: "Only an unreversed posted expense can be reversed.",
  EXPENSE_NOT_EDITABLE: "Only your draft expense can be edited.",
  INVALID_EXPENSE_CATEGORY: "Select an active expense or income category.",
  PERIOD_LOCKED: "This date is in a locked accounting period.",
  INVALID_FINANCIAL_YEAR: "Choose a date within an active financial year.",
};
export const isAccountDomainError = (error: unknown): error is Error =>
  error instanceof Error && Object.hasOwn(messages, error.message);
export function accountErrorMessage(error: unknown) {
  if (
    error instanceof AuthorizationError ||
    (error instanceof Error && error.message.startsWith("MODULE_DISABLED:"))
  )
    return "Your permission or module settings do not allow this action.";
  return error instanceof Error
    ? (messages[error.message] ??
        "Unable to save. Check the details and try again.")
    : "Unable to save. Check the details and try again.";
}
export async function accountAction(
  operation: () => Promise<string | void>,
  successMessage = "Saved successfully",
): Promise<AccountActionResult> {
  try {
    const redirectTo = await operation();
    return {
      kind: "success",
      message: successMessage,
      ...(redirectTo ? { redirectTo } : {}),
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof z.ZodError)
      return {
        kind: "error",
        message: "Check the highlighted fields.",
        fieldErrors: Object.fromEntries(
          error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      };
    return { kind: "error", message: accountErrorMessage(error) };
  }
}
