import type { AccountModule, AccountRole, ProductEdition } from "@prisma/client";
import { ACCOUNT_ROLE_PERMISSIONS, canUsePermission, type Permission } from "@/lib/auth/permissions";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-policy";

export type AccountNavItem = { label: string; href: string; module?: AccountModule; permission?: Permission };
export type AccountNavGroup = { label: string; expandable?: boolean; items: AccountNavItem[] };

const groups: AccountNavGroup[] = [
  { label: "Sales", expandable: true, items: [
    { label: "Sale Invoice", href: "/workspace/account/transactions/new?type=SALES_INVOICE", module: "SALES", permission: "ACCOUNT_SALES_ENTRY" },
    { label: "Payment-In", href: "/workspace/account/transactions/money?type=CUSTOMER_RECEIPT", module: "CUSTOMER_RECEIPTS", permission: "ACCOUNT_SETTLEMENT_ENTRY" },
    { label: "Sale Return (Credit Note)", href: "/workspace/account/transactions/new?type=CREDIT_NOTE", module: "SALES", permission: "ACCOUNT_SALES_ENTRY" },
    { label: "Estimate / Quotation", href: "/workspace/account/quotations", module: "QUOTATIONS_BOQ", permission: "ACCOUNT_QUOTATION_VIEW" },
    { label: "Proforma Invoice", href: "/workspace/account/transactions/new?type=PROFORMA_INVOICE", module: "SALES", permission: "ACCOUNT_SALES_ENTRY" },
    { label: "Sale Order", href: "/workspace/account/transactions/new?type=SALES_ORDER", module: "SALES", permission: "ACCOUNT_SALES_ENTRY" },
    { label: "Delivery Challan", href: "/workspace/account/transactions/new?type=DELIVERY_CHALLAN", module: "SALES", permission: "ACCOUNT_SALES_ENTRY" },
    { label: "Customers", href: "/workspace/account/customers", permission: "ACCOUNT_ACCOUNTS" },
  ] },
  { label: "Purchase", expandable: true, items: [
    { label: "Purchase Bills", href: "/workspace/account/transactions/new?type=PURCHASE_BILL", module: "PURCHASES", permission: "ACCOUNT_PURCHASE_ENTRY" },
    { label: "Payment-Out", href: "/workspace/account/transactions/money?type=VENDOR_PAYMENT", module: "VENDOR_PAYMENTS", permission: "ACCOUNT_SETTLEMENT_ENTRY" },
    { label: "Purchase Return (Debit Note)", href: "/workspace/account/transactions/new?type=DEBIT_NOTE", module: "PURCHASES", permission: "ACCOUNT_PURCHASE_ENTRY" },
    { label: "Purchase Order", href: "/workspace/account/transactions/new?type=PURCHASE_ORDER", module: "PURCHASES", permission: "ACCOUNT_PURCHASE_ENTRY" },
    { label: "Vendors", href: "/workspace/account/vendors", permission: "ACCOUNT_ACCOUNTS" },
  ] },
  { label: "Inventory", items: [{ label: "Items & stock", href: "/workspace/account/inventory", module: "INVENTORY", permission: "ACCOUNT_STOCK" }, { label: "Warehouses", href: "/workspace/account/inventory/warehouses", module: "INVENTORY", permission: "ACCOUNT_STOCK" }, { label: "Opening stock", href: "/workspace/account/inventory/opening", module: "INVENTORY", permission: "ACCOUNT_STOCK" }, { label: "Transfers & adjustments", href: "/workspace/account/inventory/transfers", module: "INVENTORY", permission: "ACCOUNT_STOCK" }] },
  { label: "Projects", items: [{ label: "Projects", href: "/workspace/account/projects", module: "PROJECTS", permission: "ACCOUNT_PROJECTS" }, { label: "Project costing", href: "/workspace/account/projects", module: "PROJECT_COSTING", permission: "ACCOUNT_PROJECT_COST_VIEW" }] },
  { label: "Cash & Bank", items: [{ label: "Cash & bank accounts", href: "/workspace/account/money/accounts", permission: "ACCOUNT_MONEY_VIEW" }, { label: "Transfers", href: "/workspace/account/money/transfers", permission: "ACCOUNT_MONEY_VIEW" }, { label: "Capital & drawings", href: "/workspace/account/money/capital", permission: "ACCOUNT_MONEY_VIEW" }, { label: "Loans", href: "/workspace/account/money/loans", permission: "ACCOUNT_LOAN_ADMIN" }] },
  { label: "Accounting", items: [{ label: "Chart of Accounts", href: "/workspace/account/accounting/accounts", permission: "ACCOUNT_LEDGER_VIEW" }, { label: "Journals", href: "/workspace/account/accounting/journals", permission: "ACCOUNT_LEDGER_VIEW" }, { label: "Expenses", href: "/workspace/account/expenses", module: "EXPENSES", permission: "ACCOUNT_EXPENSE_VIEW" }, { label: "Assets", href: "/workspace/account/assets", module: "ASSETS", permission: "ACCOUNT_ACCOUNTS" }, { label: "Financial Years", href: "/workspace/account/utilities/financial-year", permission: "ACCOUNT_PERIOD_LOCK" }, { label: "Period Locks", href: "/workspace/account/utilities/period-locks", permission: "ACCOUNT_PERIOD_LOCK" }] },
  { label: "Reports", items: [{ label: "Reports hub", href: "/workspace/account/reports", permission: "ACCOUNT_REPORTS" }, { label: "Profit & Loss", href: "/workspace/account/reports/profit-loss", permission: "ACCOUNT_REPORTS" }, { label: "Balance Sheet", href: "/workspace/account/reports/balance-sheet", permission: "ACCOUNT_REPORTS" }, { label: "Trial Balance", href: "/workspace/account/reports/trial-balance", permission: "ACCOUNT_REPORTS" }] },
  { label: "Utilities", items: [{ label: "Import, export & backup", href: "/workspace/account/utilities", permission: "ACCOUNT_REPORTS" }] },
  { label: "Company / Branch", items: [{ label: "Company details", href: "/workspace/company-profile", permission: "COMPANY_VIEW" }] },
  { label: "Users & Permissions", items: [{ label: "Users & permissions", href: "/workspace/employees", permission: "ACCOUNT_USER_ADMIN" }] },
  { label: "Settings", items: [{ label: "Settings", href: "/workspace/account/settings", permission: "ACCOUNT_SETTINGS" }] },
  { label: "Help / Support", items: [{ label: "Contact SalesPunch360", href: "/contact" }, { label: "Frequently asked questions", href: "/resources/faq" }] },
];

export function buildAccountNavigation(actor: WorkspacePrincipal, edition: ProductEdition, enabled: readonly AccountModule[]) {
  const set = new Set(enabled);
  return groups.map(group => ({ ...group, items: group.items.filter(item => (!item.module || set.has(item.module)) && (!item.permission || canUsePermission(actor, edition, item.permission))) })).filter(group => group.items.length);
}
export function rolePermissionSummary(role: AccountRole | null) { return role ? ACCOUNT_ROLE_PERMISSIONS[role] : []; }
