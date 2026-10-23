import {referenceReportAliases} from "./reference-inventory";
/** Supported report-service destinations shared by web and native. */
export const REPORT_CATALOGUE = [
  ["hsn-sales", "Sale Summary by HSN", "Tax"],
  ["sac-sales", "SAC Report", "Tax"],
  ["order-transactions", "Order Transaction Report", "Order reports"],
  ["order-items", "Order Item Report", "Order reports"],
  ["expense-transactions", "Expense Transactions", "Expense reports"],
  ["expense-category", "Expense Category Report", "Expense reports"],
  ["expense-items", "Expense Item Report", "Expense reports"],
  ["sale-report", "Sale Report", "Transaction"],
  ["purchase-report", "Purchase Report", "Transaction"],
  ["purchase-register", "Purchase Register", "Transaction"],
  ["profit-loss", "Profit & Loss", "Business"],
  ["balance-sheet", "Balance Sheet", "Business"],
  ["trial-balance", "Trial Balance", "Business"],
  ["cash-flow", "Cash Flow", "Cash & Bank"],
  ["general-ledger", "General Ledger", "Accounting"],
  ["customer-ledger", "Customer Ledger", "Parties"],
  ["vendor-ledger", "Vendor Ledger", "Parties"],
  ["receivable-aging", "Receivable Aging", "Parties"],
  ["payable-aging", "Payable Aging", "Parties"],
  ["loan-statement", "Loan Statement", "Business status"],
  ["bank-statement", "Bank Statement", "Business status"],
  ["cash-bank", "Cash & Bank", "Cash & Bank"],
  ["owner-capital", "Owner / Partner Capital", "Owners & Partners"],
  ["profit-withdrawal", "Profit Withdrawal", "Owners & Partners"],
  ["projects", "Project Report", "Projects"],
  ["material-consumption", "Material Consumption", "Projects"],
  ["project-transfer", "Project Transfer", "Projects"],
  ["branches", "Branch Report", "Business"],
  ["items", "Item Wise Profit & Loss", "Item/Stock reports"],
  ["stock-category", "Stock Summary by Item Category", "Item/Stock reports"],
  ["stock-summary", "Stock Summary Report", "Item/Stock reports"],
  ["low-stock-summary", "Low Stock Summary Report", "Item/Stock reports"],
  ["stock-detail", "Stock Detail Report", "Item/Stock reports"],
  ["item-serial", "Item Serial Report", "Item/Stock reports"],
  ["invoices", "Bill Wise Profit", "Transaction"],
  ["sale-purchase-party", "Sale/Purchase by Party", "Party reports"],
  ["discount-party", "Discount Report", "Business status"],
  ["item-discount", "Item Wise Discount Report", "Item/Stock reports"],
  ["customers", "Party Wise Profit & Loss", "Party reports"],
  ["tax", "GST / Tax Report", "Tax"],
  ["gst-party", "GST Report", "Business status"],
  ["tds-receivable", "TDS Receivable", "Tax"],
  ["tds-payable", "TDS Payable", "Tax"],
  ["tcs-collected", "TCS Collected Report", "Tax"],
  ["tcs-receivable", "TCS Receivable", "Tax"],
  ["gst-rate", "GST Rate Report", "Business status"],
  ["budget-vs-actual", "Budget vs Actual", "Projects"],
].map(([key, name, group]) => ({ key, name, group }));
export const ACCOUNT_REPORT_KEYS = REPORT_CATALOGUE.map((x) => x.key);
export function reportsForRole(role: string | null | undefined) {
  return role === "PROJECT_MANAGER"
    ? REPORT_CATALOGUE.filter((x) => x.key === "projects")
    : REPORT_CATALOGUE;
}
export function searchReportCatalogue(
  role: string | null | undefined,
  search: string,
) {
  const query = search.trim().toLocaleLowerCase();
  return reportsForRole(role).filter((x) =>
    `${x.name} ${x.group} ${x.key} ${referenceReportAliases(x.key).join(" ")}`.toLocaleLowerCase().includes(query),
  );
}

const specificFilters: Record<string, string[]> = {
  "sac-sales":["classificationSide"],
  "order-transactions":["orderType","orderStatus","customerId","vendorId"],
  "order-items":["orderType","orderStatus","customerId","vendorId"],
  "cash-bank":["accountType"],
  "tcs-collected": ["customerId"],
  "tds-receivable": ["customerId"],
  "tds-payable": ["vendorId"],
  "tcs-receivable": ["vendorId"],
  "loan-statement": ["loanId"],
  "bank-statement": ["moneyAccountId"],
  "stock-summary": ["categoryId", "itemStatus", "stockLevel", "itemSearch"],
  "low-stock-summary": ["categoryId", "itemStatus", "itemSearch"],
  "item-discount": ["customerId", "categoryId", "itemSearch"],
  "item-serial": ["productId", "itemSearch"],
  "stock-detail": ["categoryId", "itemStatus", "itemSearch"],
  "expense-transactions": ["projectId"],
  "expense-category": ["projectId"],
  "expense-items": ["projectId"],
  "sale-report": ["customerId", "projectId"],
  "purchase-report": ["vendorId", "projectId"],
  "general-ledger": ["ledgerId"],
  "customer-ledger": ["customerId"],
  "vendor-ledger": ["vendorId"],
  "purchase-register": ["vendorId"],
  "owner-capital": ["ownerId"],
  "profit-withdrawal": ["ownerId"],
  projects: ["projectId"],
  "budget-vs-actual": ["projectId"],
  items: ["projectId", "customerId", "productId"],
  invoices: ["projectId", "customerId", "productId"],
  customers: ["projectId", "customerId", "productId"],
  "project-material-balance": ["projectId", "productId"],
  "material-consumption": ["projectId", "productId"],
  "project-transfer": ["projectId", "productId"],
};
export function reportSpecificFilters(key: string) {
  return specificFilters[key] ?? [];
}
export function reportCatalogueWithFilters(entries = REPORT_CATALOGUE) {
  return entries.map((entry) => ({
    ...entry,
    filters: reportSpecificFilters(entry.key),
    aliases:referenceReportAliases(entry.key),
  }));
}
