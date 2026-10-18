/** Supported report-service destinations shared by web and native. */
export const REPORT_CATALOGUE = [
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
  ["cash-bank", "Cash & Bank", "Cash & Bank"],
  ["owner-capital", "Owner / Partner Capital", "Owners & Partners"],
  ["profit-withdrawal", "Profit Withdrawal", "Owners & Partners"],
  ["projects", "Project Report", "Projects"],
  ["material-consumption", "Material Consumption", "Projects"],
  ["project-transfer", "Project Transfer", "Projects"],
  ["branches", "Branch Report", "Business"],
  ["items", "Item Wise Profit & Loss", "Item/Stock reports"],
  ["stock-category", "Stock Summary by Item Category", "Item/Stock reports"],
  ["stock-detail", "Stock Detail Report", "Item/Stock reports"],
  ["invoices", "Bill Wise Profit", "Transaction"],
  ["customers", "Party Wise Profit & Loss", "Party reports"],
  ["tax", "GST / Tax Report", "Tax"],
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
    `${x.name} ${x.group} ${x.key}`.toLocaleLowerCase().includes(query),
  );
}

const specificFilters: Record<string, string[]> = {
  "cash-bank":["accountType"],
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
  }));
}
