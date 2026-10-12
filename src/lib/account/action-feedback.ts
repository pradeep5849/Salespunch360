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
  INVALID_OPENING_WAREHOUSE:
    "Select an active warehouse in an authorized branch for opening stock.",
  OPENING_REQUEST_KEY_REQUIRED: "Refresh Add Item before saving opening stock.",
  OPENING_CREATE_ONLY:
    "Opening stock is recorded when creating an item. Use stock adjustments to correct an existing item.",
  INVALID_OPENING_PRODUCT:
    "Opening stock requires an inventory-tracked item without batch or serial tracking.",
  OPENING_VALUE_OUT_OF_RANGE:
    "Opening stock value is too large. Check the quantity and price per unit.",
  WHOLESALE_PRICING_DISABLED: "Wholesale pricing is disabled in Item Settings.",
  CUSTOMER_PRICING_DISABLED: "Party-wise pricing is disabled in Item Settings.",
  INVALID_PRICE_DATES:
    "The price start date must be on or before its end date.",
  PRICE_VALUE_OUT_OF_RANGE: "The price is too large. Enter a smaller amount.",
  INVALID_OWNER:
    "Choose an active app user from this business, or leave the user link empty.",
  OWNER_USER_ALREADY_LINKED:
    "This app user is already linked to an owner or partner. Open that record to edit it.",
  INVALID_CHEQUE_INITIAL_STATUS:
    "Record a cheque as Issued or Received before changing its status.",
  INVALID_CHEQUE_TRANSITION:
    "This cheque status has changed or the selected action is unavailable. Refresh and try again.",
  CHEQUE_RECEIPT_REQUIRED:
    "Record the linked receipt or payment before marking this cheque cleared.",
  ITEM_IDENTIFIER_EXISTS:
    "This item code or barcode is already in use. Enter another code and try again.",
  INSUFFICIENT_MONEY_BALANCE:
    "The selected bank or cash account has insufficient funds. Reduce the amount or select another account.",
  IDEMPOTENCY_CONFLICT:
    "This request was already used with different details. Refresh before starting a new transaction.",
  RECURRING_NOT_DUE: "This recurring bill is not due yet.",
  RECURRING_DUE_DATE_CHANGED:
    "This occurrence has changed. Refresh the schedule before generating another bill.",
  INVALID_DUE_DATE: "Enter a valid calendar date.",
  INVALID_SERVICE_REMINDER:
    "This reminder is no longer due or is outside your branch access. Refresh Attention.",
  SERVICE_PERIOD_OVERRIDE_DISABLED:
    "Editing the service period during a sale is disabled in Service Reminders.",
  INVALID_SERVICE_REMINDER_ITEM:
    "Enable service reminders for this item before setting a service period.",
  INVALID_SERVICE_PERIOD: "Enter a service period from 1 to 3650 days.",
  INVALID_PAYMENT_DISCOUNT:
    "Enter a valid payment discount for the selected invoice.",
  PAYMENT_DISCOUNT_DISABLED:
    "Discount during Payment is disabled. Enable it in Transaction Settings or remove the discount.",
  ALLOCATION_EXCEEDS_OUTSTANDING:
    "Cash received plus payment discount cannot exceed the invoice balance.",
  ALLOCATION_TOTAL_MISMATCH:
    "The allocated amount must equal the cash payment plus its discount.",
  BUSINESS_CURRENCY_LOCKED:
    "Business currency cannot be changed after accounting entries have been posted.",
  PROJECT_EXTRA_JOBS_PENDING:
    "Approve or cancel pending extra jobs before closing the project.",
  PROJECT_FINAL_INVOICE_SERVICE_REQUIRED:
    "Choose the service / SAC for the remaining project invoice.",
  ADJUSTMENT_STOCK_EXCEEDS_SOURCE:
    "The cumulative returned quantity exceeds the original purchase quantity.",
  INVALID_SOURCE_STOCK_IDENTITY:
    "Use the original purchase product, batch and serial number for a supplier return.",
  PROJECT_PURCHASE_MATERIAL_SOURCE_REQUIRED:
    "The original Project material receipt is missing. Review the purchase history before returning it.",
  ITEMS_DISABLED: "Items are disabled in General settings.",
  SERVICES_DISABLED: "Service items are disabled in Item settings.",
  ITEM_UNITS_DISABLED: "Item units are disabled in Item settings.",
  ITEM_CATEGORY_DISABLED: "Item categories are disabled in Item settings.",
  ITEM_DESCRIPTION_DISABLED: "Item descriptions are disabled in Item settings.",
  ITEM_HSN_DISABLED: "HSN/SAC fields are disabled in Item settings.",
  ITEM_TAX_DISABLED: "Item tax is disabled in Item settings.",
  ITEM_CUSTOM_FIELDS_DISABLED:
    "Item custom fields are disabled in Item settings.",
  PRODUCTS_DISABLED: "Product items are disabled in General settings.",
  STOCK_FIELDS_DISABLED: "Stock maintenance is disabled in General settings.",
  BATCH_REQUIRED: "Select a batch for this product.",
  SERIAL_QUANTITY_MISMATCH:
    "Select a serial number and issue exactly one unit.",
  INVALID_INVENTORY_TRACKING:
    "The tracking selection does not match this product.",
  INVALID_INVENTORY_BATCH: "Select a batch belonging to this product.",
  EXPIRED_STOCK:
    "This batch or serial number has expired for the effective date.",
  SERIAL_NOT_AVAILABLE:
    "This serial-numbered unit is not available in the selected warehouse.",
  INVALID_INVENTORY_PRODUCT:
    "Select an active inventory product from this company.",

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
  INSUFFICIENT_PROJECT_MATERIAL:
    "Quantity exceeds the material currently available to this Project.",
  INSUFFICIENT_STOCK:
    "Stock is insufficient and negative stock is disabled in General settings.",
  PROJECT_BUDGET_IN_USE:
    "A budget line linked to material or purchases cannot be removed. Edit its existing amount or add a new line.",
  INVALID_PROJECT_BUDGET_LINE:
    "Select a budget line belonging to the selected Project.",
  INVALID_PROJECT_MATERIAL_CONTEXT:
    "Select this Project's warehouse, product and budget line.",
  INVALID_MATERIAL_LINEAGE:
    "Select an original material receipt from this Project.",
  MOVEMENT_ALREADY_REVERSED: "This movement has already been reversed.",
  REVERSE_TRANSFER_FROM_SOURCE_PROJECT:
    "Reverse the transfer from its source Project to reverse both sides together.",
  REVERSE_PROJECT_PURCHASE_DOCUMENT:
    "Correct this receipt through its purchase document.",
  CROSS_BRANCH_PROJECT_TRANSFER_NOT_ALLOWED:
    "Select a destination Project in the same branch.",
  INVALID_SOURCE_MOVEMENT: "Select a material movement from this company.",
  INVALID_DESTINATION_PROJECT: "Select an accessible destination Project.",
  ADVANCE_APPLICATION_EXCEEDS_BALANCE:
    "Amount exceeds the unused advance or invoice balance.",
  INVALID_ADVANCE_APPLICATION:
    "Choose an advance for the same customer, branch and Project as this invoice.",
  SOURCE_JOURNAL_MISSING:
    "The original accounting posting is missing. Ask your administrator to review it.",
  PROJECT_FINAL:
    "This Project is closed and can only be viewed or reported on.",
  INVALID_PROJECT_ESTIMATED_COST:
    "The resulting Project estimated cost cannot be negative.",
  INVALID_PROJECT_VALUE:
    "The resulting Project contract value cannot be negative.",
  CHANGE_ORDER_NOT_EDITABLE: "Only a draft change order can be edited.",
  INVALID_CHANGE_ORDER_TRANSITION:
    "This action is not allowed for the current change-order status.",
  CHANGE_ORDER_SELF_APPROVAL_FORBIDDEN:
    "A different authorized administrator must approve or reject this change order.",
  PROJECT_REQUIRED: "Select an authorized project.",
  OTHER_INCOME_TAX_REQUIRES_A12:
    "Other Income currently supports non-taxable entries. Set GST and CESS to zero.",
  EXPENSE_NOT_APPROVED: "Submit and approve the expense before posting.",
  INVALID_EXPENSE_TRANSITION:
    "This action is no longer available for the current status.",
  EXPENSE_NOT_REVERSIBLE: "Only an unreversed posted expense can be reversed.",
  EXPENSE_NOT_EDITABLE: "Only your draft expense can be edited.",
  INVALID_EXPENSE_CATEGORY: "Select an active expense or income category.",
  MANAGED_LOAN_REVERSAL_NOT_SUPPORTED:
    "Loan receipts and repayments cannot be reversed through the journal screen. Their loan balance must remain linked to the posted transaction.",
  PERIOD_LOCKED: "This date is in a locked accounting period.",
  INVALID_FINANCIAL_YEAR: "Choose a date within an active financial year.",
};
export const isAccountDomainError = (error: unknown): error is Error =>
  error instanceof Error &&
  (Object.hasOwn(messages, error.message) ||
    /^(CUSTOM_FIELDS_REQUIRED|INVALID_CUSTOM_FIELD):[a-zA-Z0-9_]+$/.test(
      error.message,
    ));
export function accountErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    /^CUSTOM_FIELDS_REQUIRED:[a-zA-Z0-9_]+$/.test(error.message)
  )
    return "Complete the required custom fields before saving.";
  if (
    error instanceof Error &&
    /^INVALID_CUSTOM_FIELD:[a-zA-Z0-9_]+$/.test(error.message)
  )
    return "Check the value and format of the custom fields.";
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
