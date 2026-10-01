import { z } from "zod";

export const TRANSACTION_SETTING_SECTIONS = [
  "Transaction Header",
  "Items Table",
  "Taxes, Discount & Total",
  "More Transaction Features",
  "GST",
  "Transaction Prefixes",
] as const;

export const TRANSACTION_TOGGLES = {
  "Transaction Header": [
    ["showInvoiceNumber", "Invoice/Bill Number"], ["cashSaleByDefault", "Cash Sale by default"],
    ["billingName", "Billing name of Parties"], ["customerPoDetails", "PO Details (of customer)"],
    ["transactionTime", "Add Time On Transactions"],
  ],
  "Items Table": [
    ["rateTaxMode", "Allow Inclusive/Exclusive tax on Rate (Price/unit)"], ["displayPurchasePrice", "Display Purchase Price"],
    ["lastFiveSalePrices", "Show Last 5 Sale Price of Items"], ["freeItemQuantity", "Free Item quantity"],
    ["itemCount", "Count"], ["barcodeScanning", "Barcode scanning for items"],
  ],
  "Taxes, Discount & Total": [
    ["transactionTax", "Transaction wise Tax"], ["transactionDiscount", "Transaction wise Discount"],
    ["roundOff", "Round Off Transaction amount"],
  ],
  "More Transaction Features": [
    ["discountDuringPayment", "Discount during Payment"], ["linkPayments", "Link Payments to Invoices"],
    ["invoicePreview", "Enable Invoice Preview"], ["termsEnabled", "Terms & Conditions"],
    ["showProfit", "Show Profit while making Sale Invoice"],
  ],
  GST: [["reverseCharge", "Reverse Charge"], ["stateOfSupply", "State of Supply"], ["ewayBillNumber", "E-Way Bill No."]],
} as const;

export const PREFIX_TYPES = [
  ["SALES_INVOICE", "Sale invoices"], ["CREDIT_NOTE", "Credit Note"], ["SALES_ORDER", "Sale Order"],
  ["PURCHASE_ORDER", "Purchase Order"], ["ESTIMATE", "Estimate"], ["PROFORMA_INVOICE", "Proforma Invoice"],
  ["DELIVERY_CHALLAN", "Delivery Challan"], ["CUSTOMER_RECEIPT", "Payment-In"],
] as const;

const toggleKeys = Object.values(TRANSACTION_TOGGLES).flat().map(([key]) => key);
export const transactionPreferencesSchema = z.object(Object.fromEntries(toggleKeys.map(key => [key, z.boolean()])) as Record<(typeof toggleKeys)[number], z.ZodBoolean>)
  .extend({ shareAs: z.enum(["ASK", "PDF"]), roundingMode: z.literal("NEAREST"), roundingStep: z.coerce.number().positive().max(100) });

export type TransactionPreferences = z.infer<typeof transactionPreferencesSchema>;
export const DEFAULT_TRANSACTION_PREFERENCES: TransactionPreferences = {
  showInvoiceNumber: true, cashSaleByDefault: false, billingName: true, customerPoDetails: false, transactionTime: false,
  rateTaxMode: true, displayPurchasePrice: false, lastFiveSalePrices: false, freeItemQuantity: false, itemCount: false, barcodeScanning: false,
  transactionTax: true, transactionDiscount: true, roundOff: false, discountDuringPayment: false, linkPayments: true,
  invoicePreview: true, termsEnabled: true, showProfit: false, reverseCharge: true, stateOfSupply: true, ewayBillNumber: false,
  shareAs: "ASK", roundingMode: "NEAREST", roundingStep: 1,
};

export function normalizeTransactionPreferences(value: unknown): TransactionPreferences {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return transactionPreferencesSchema.parse({ ...DEFAULT_TRANSACTION_PREFERENCES, ...source });
}
