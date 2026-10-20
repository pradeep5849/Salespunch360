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
  INVALID_ITEM_UNIT_CONVERSION:"Select two different active units and enter a positive conversion factor with at most four decimal places.",
  INVALID_OWNER_HISTORY_SCOPE:"Choose a branch or all authorized branches, then reload the owner history.",
  OWNER_CORRECTION_ALREADY_POSTED: "This transaction already has a correction. Open its recorded history; retry only with the same date and reason.",
  OWNER_CORRECTION_BEFORE_TRANSACTION: "The correction date cannot precede the original transaction date.",
  INVALID_OWNER_TRANSACTION_SOURCE: "The retained transaction has no matching source journal. Reconcile its recorded history before correcting it.",
  CUSTOM_FIELD_PRINT_UNSUPPORTED: "Printing custom fields is unavailable for this entity. Keep Show in print off.",
  MANAGED_CORRECTION_REVERSAL_REQUIRED:"Use the original transaction workflow to make the next correction. Reversing its correction journal cannot reopen the business record.",
  OWNER_CONTRIBUTION_HAS_ASSET_FUNDING:"Cancel the contribution’s asset funding allocations before reversing it. Reverse any related capital repayments first.",
  ASSET_FUNDING_REPAYMENT_REALLOCATED:"Later funding uses the asset’s released share. Correct those allocations before reversing this capital repayment.",
  ASSET_FUNDING_CHANGED:"The asset cost changed. Reload its current funding details before confirming the allocation.",
  ASSET_FUNDING_INVALID_STATE:"The saved funding amounts are inconsistent. Reconcile their recorded transactions before continuing.",
  OWNER_WITHDRAWAL_CLASSIFICATION_REQUIRED: "Choose Capital withdrawal or Profit distribution before posting a new withdrawal.",
  REPORT_FILTER_NOT_SUPPORTED: "This filter is not supported by the selected report. Clear it and run the report again.",
  REPORT_PDF_UNSUPPORTED_CHARACTER: "This report contains a character not supported by the PDF fonts. Use Excel or CSV to preserve the original text.",
  ASSET_FUNDING_EXCEEDS_AVAILABLE:"This exceeds the contribution, asset cost or available unallocated owner capital.",
  INVALID_ASSET_FUNDING_SOURCE:"Choose a retained asset and posted investment for the same owner, company and branch, dated before this allocation.",
  INVALID_ASSET_FUNDING_RETURN:"Choose a valid funding allocation for this owner and branch, dated before the repayment.",
  ASSET_FUNDING_RETURN_EXCEEDS_PAYMENT:"Attributed capital repayments cannot exceed the total capital withdrawal.",
  ASSET_FUNDING_RETURN_EXCEEDS_BALANCE:"The repayment exceeds this asset’s remaining owner funding.",
  INSUFFICIENT_OWNER_CAPITAL:"The owner does not have enough posted capital for this capital return.",
  ASSET_FUNDING_ATTRIBUTION_REQUIRED:"Some capital is allocated to retained assets. Select the funding being repaid, or reduce the unallocated capital withdrawal.",
  ASSET_FUNDING_HAS_REPAYMENTS:"Reverse the related capital repayments before cancelling this allocation.",
  ASSET_FUNDING_ALREADY_CANCELLED:"This allocation is already cancelled. Open its recorded history.",
  TRANSFER_IMAGE_ALREADY_ATTACHED:"This transfer already has a saved image. Open the existing transfer; its image cannot be replaced here.",
  INVALID_TRANSFER_IMAGE:"Choose a valid PNG, JPEG or WebP image up to 5 MB.",
  TRANSFER_POSTED_IMAGE_UPLOAD_FAILED:"The transfer was posted, but its image could not be saved. Retry this same form to attach it without posting again.",
  UNIT_HAS_TRANSACTION_HISTORY:"This item already has stock or document quantities. Its base unit cannot be changed; use a conversion instead.",
  INSUFFICIENT_FUNDS:"The receipt account does not have enough posted funds to reverse this loan receipt.",
  LOAN_BALANCE_AMBIGUOUS:"This legacy loan shares its liability ledger with another loan. Separate their opening balances before changing financial history.",
  LOAN_HAS_FINANCIAL_ACTIVITY:"This loan has payments, top-ups, or corrections. Resolve those transactions before cancelling its receipt.",
  LOAN_ARCHIVE_REQUIRES_ZERO_BALANCE:"Only a loan with zero posted principal can be archived.",
  LOAN_NOT_ARCHIVED:"This loan is not archived. Reload its latest details.",
  INVALID_LOAN_DATE:"The transaction date cannot precede the original loan date.",
  LOAN_CHANGED:"This loan changed. Reload its latest details before saving again.",
  BANK_ACCOUNT_NOT_AVAILABLE:"Select an active bank account available to your branch.",
  BANK_UPI_REQUIRED:"Enter a valid UPI ID before enabling the payment QR on invoices.",
  BANK_METADATA_NOT_APPLICABLE:"Bank details and payment QR settings apply to bank accounts. Select a bank account.",
  INVALID_LOAN:"Select an active loan from this business and branch.",
  PRINCIPAL_EXCEEDS_OUTSTANDING:"Principal paid cannot exceed the outstanding principal. Check the amount.",
  INTEREST_LEDGER_MISSING:"Set up the general expense ledger before recording interest or charges.",
  CHEQUE_NUMBER_REQUIRED:
    "Enter the cheque number before recording this payment.",
  CHEQUE_AMOUNT_REQUIRED:
    "Enter a positive cheque amount. A payment discount alone does not require a cheque.",
  QUOTATION_APPROVAL_REQUIRED: "Only approved estimates can be converted. Approve the current revision first.",
  INVALID_SALE_LINE_SOURCE:
    "A retained item must belong to this invoice and keep its original item identity. Add a new line to change the item.",
  SALE_LEDGER_SOURCE_REQUIRED:
    "This older Sale has no posted ledger source. Reconcile its original entries before correcting it.",
  CHEQUE_BANK_REQUIRED:
    "Add or select an active bank account before recording the cheque.",
  CHEQUE_NUMBER_EXISTS:
    "This cheque number is already recorded for the selected bank. Open the existing cheque.",
  CHEQUE_CHANGED:
    "This cheque changed. Refresh before closing or reopening it.",
  CHEQUE_NOT_DUE: "The closure date cannot be before the cheque date.",
  INVALID_CHEQUE_SOURCE:
    "The cheque source is inconsistent. Refresh or complete its source details.",
  LEGACY_CHEQUE_SOURCE_REQUIRED:
    "This legacy cheque needs its original amount and receipt/payment source before a financial action.",
  INVALID_CHEQUE_CORRECTION_DATE:
    "The correction date cannot be before the original payment date.",
  CHEQUE_FINANCIAL_ACTION_REQUIRED:
    "Use Close, Re-Open or Bounce with a date and reason from the cheque page.",
  MANAGED_SETTLEMENT_REVERSAL_REQUIRED:
    "Correct this payment from its source or cheque so allocations and accounting stay consistent.",
  MANAGED_ADVANCE_REVERSAL_REQUIRED:
    "Correct this advance application through its payment lifecycle.",

  RECURRING_DUE_DATE_IMMUTABLE:
    "A recurring bill keeps its original due date. Enter the actual payment date when marking it paid.",
  RECURRING_SCHEDULE_CHANGED:
    "This schedule changed. Refresh before editing it.",
  RECURRING_OCCURRENCE_ALREADY_EXISTS:
    "A bill already exists for that due date. Choose a different next due date.",
  RECURRING_PAYMENT_DATE_REQUIRED:
    "Record this recurring bill's payment with its actual payment date and account.",
  RECURRING_BILL_NOT_PAYABLE:
    "This recurring bill is already paid or cannot accept payment. Refresh the bill.",
  INVALID_EXPENSE_ITEM_PHOTO: "Select a valid image smaller than 5 MB.",
  EXPENSE_ITEM_NAME_EXISTS:
    "This expense item already exists. Select it from the catalogue.",
  PAID_EXPENSE_REQUEST_KEY_REQUIRED:
    "Refresh the expense form before recording payment.",
  REIMBURSEMENT_NOT_PAID_ENTRY:
    "Save reimbursements as drafts and use their approval and payment workflow.",
  EXPENSE_REVIEW_RETRY_CONFLICT:
    "This review was already recorded with a different reason. Refresh the expense.",
  INVALID_EXPENSE_REVIEW_TRANSITION:
    "This expense no longer has a pending approval review. Refresh the expense.",
  MANAGED_EXPENSE_REVERSAL_REQUIRED:
    "Reverse this payment from its expense detail so the expense and ledger stay consistent.",
  INVALID_OPENING_WAREHOUSE:
    "Select an active warehouse in an authorized branch for opening stock.",
  OPENING_REQUEST_KEY_REQUIRED: "Refresh Add Item before saving opening stock.",
  OPENING_CREATE_ONLY:
    "Opening stock is recorded when creating an item. Use stock adjustments to correct an existing item.",
  INVALID_OPENING_PRODUCT:
    "Opening stock requires an inventory-tracked item without batch or serial tracking.",
  OPENING_VALUE_OUT_OF_RANGE:
    "Opening stock value is too large. Check the quantity and price per unit.",
  ITEM_DISCOUNT_DISABLED: "Item discounts are disabled in Item Settings.",
  INVALID_DISCOUNT: "Enter a discount within the item price or 0–100 percent.",
  SALE_PRICE_UPDATE_DISABLED: "Updating saved sale prices is disabled in Item Settings.",
  SALE_PRICE_DOCUMENT_CHANGED: "This invoice was corrected or reversed. Its saved item prices were not changed.",
  SALE_PRICE_ITEM_UNAVAILABLE: "This invoice item is no longer available for price updates.",
  SALE_PRICE_CHANGED: "The saved item price changed. Refresh the price choices before updating it.",
  MRP_PRICING_DISABLED: "Enable Tax on MRP in Item Settings before entering an MRP.",
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
    "Business currency cannot be changed after payments or accounting entries have been recorded.",
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
  UNIT_NAME_OR_SYMBOL_EXISTS:
    "A unit with this name or short name already exists.",
  INVALID_UNIT: "Select active units belonging to this company.",
  INVALID_UNIT_CONVERSION:
    "Choose different units and a positive conversion rate with at most four decimal places.",
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
