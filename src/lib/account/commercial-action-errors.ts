import { ZodError } from "zod";

const messages: Record<string, string> = {
  IDEMPOTENCY_KEY_REUSED: "This request reference was used for different document details. Review the saved document before continuing.",
  WAREHOUSE_REQUIRED_FOR_INVENTORY:
    "Select Warehouse for this inventory item. If none is available, add an active warehouse for this branch.",
  INVALID_INVENTORY_WAREHOUSE:
    "Select an active warehouse belonging to the invoice branch.",
  INSUFFICIENT_STOCK:
    "The selected tracked stock is not available in this warehouse.",
  INVALID_BRANCH: "Select an active branch you are authorized to use.",
  INVALID_CUSTOMER:
    "Select an active Account customer belonging to this branch.",
  INVALID_FINANCIAL_YEAR:
    "The invoice date must fall in an open financial year.",
  PERIOD_LOCKED: "The accounting period for this invoice date is locked.",
  SYSTEM_LEDGER_MISSING:
    "Required accounting ledgers are missing. Ask your Account administrator to configure them.",
  MODULE_DISABLED: "The required Account module is disabled for this company.",
  AUTHENTICATION_REQUIRED: "Your session has expired. Sign in again.",
  NOT_AUTHORIZED: "You do not have permission to save this invoice.",
  INVALID_LINE_TYPE: "Select a supported sales item type.",
  LINE_SOURCE_REQUIRED: "Select an item for every invoice line.",
  INVALID_LINE_SOURCE:
    "An invoice item is unavailable. Select an active item from this company.",
  INVALID_AMOUNT: "Check the item quantity, rate, discount and tax amounts.",
  INVALID_DISCOUNT: "The discount cannot exceed the item amount or 100%.",
  INVALID_TAX_INPUT: "Check the invoice tax amounts.",
  INVALID_PURCHASE_CHARGES:
    "Check the invoice charges. Round off must be within 10.",
  BATCH_REQUIRED: "Select a batch for this batch-tracked item.",
  SERIAL_QUANTITY_MISMATCH:
    "Select a serial number and use quantity 1 for this serial-tracked item.",
  INVALID_INVENTORY_BATCH: "Select a valid batch for this item.",
  INVALID_INVENTORY_SERIAL: "Select a valid serial number for this item.",
  SERIAL_NOT_AVAILABLE:
    "The selected serial number is not available in this warehouse.",
  SERIAL_ALREADY_IN_STOCK: "The selected serial number is already in stock.",
  EXPIRED_STOCK: "The selected batch or serial number has expired.",
  INVALID_RETURN_QUANTITY:
    "The stock return quantity cannot exceed the item quantity.",
  DUPLICATE_DOCUMENT_NUMBER:
    "That invoice number already exists for this branch. Choose another number.",
  NUMBERING_SERIES_NOT_FOUND:
    "The invoice numbering series is unavailable. Ask your Account administrator to configure it.",
  ITEMS_DISABLED: "Items are disabled in Account settings.",
  PRODUCTS_DISABLED: "Products are disabled in Account item settings.",
  SERVICES_DISABLED: "Services are disabled in Account item settings.",
  ITEM_DESCRIPTION_DISABLED:
    "Item descriptions are disabled in Account settings.",
  ITEM_DISCOUNT_DISABLED: "Item discounts are disabled in Account settings.",
  ITEM_TAX_DISABLED: "Item tax is disabled in Account settings.",
  ITEM_CESS_DISABLED: "Item cess is disabled in Account settings.",
  STOCK_FIELDS_DISABLED:
    "Stock fields are not allowed for this item under the current Account settings.",
  P2002:
    "A document with the same unique reference already exists. Refresh and check the invoice number.",
  P2003:
    "A selected reference is no longer available. Refresh and select the customer, item and warehouse again.",
  P2034: "Another transaction changed this record. Refresh and try again.",
};
export type CommercialCreateResult =
  | { ok: true; id: string; documentNumber: string }
  | { ok: false; errorCode: string; message: string };

export function commercialActionFailure(
  error: unknown,
): Extract<CommercialCreateResult, { ok: false }> {
  if (error instanceof ZodError) {
    return {
      ok: false,
      errorCode: "INVALID_INPUT",
      message:
        "Check the invoice fields, including item references and State of Supply for GST.",
    };
  }
  const rawCode = error instanceof Error ? error.message : "";
  const code =
    error instanceof Error && error.name === "AuthorizationError"
      ? "NOT_AUTHORIZED"
      : rawCode.split(":")[0];
  const databaseCode =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";
  const errorCode = messages[code]
    ? code
    : messages[databaseCode]
      ? databaseCode
      : "SAVE_FAILED";
  return {
    ok: false,
    errorCode,
    message:
      messages[errorCode] ??
      "The invoice could not be saved. Contact support with the time of this attempt.",
  };
}
