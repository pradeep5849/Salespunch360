/** Only verified report service destinations are advertised as available. */
export const REPORT_CATALOGUE = [
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
  ["branches", "Branch Report", "Business"],
  ["items", "Item Profitability", "Items"],
  ["invoices", "Invoice Report", "Sales"],
  ["customers", "Customer Report", "Parties"],
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
