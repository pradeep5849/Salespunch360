import type { LedgerAccountClass, NormalBalanceSide, Prisma } from "@prisma/client";
export const DEFAULT_LEDGER_ACCOUNTS: Prisma.LedgerAccountCreateWithoutCompanyInput[] = [
 ["1000","Cash","ASSET","DEBIT","CASH"],["1100","Bank","ASSET","DEBIT","BANK"],["1200","Accounts Receivable","ASSET","DEBIT","ACCOUNTS_RECEIVABLE"],["1300","Inventory","ASSET","DEBIT","INVENTORY"],["1400","Advances","ASSET","DEBIT","ADVANCES"],["1500","Fixed Assets","ASSET","DEBIT","FIXED_ASSETS"],
 ["2000","Accounts Payable","LIABILITY","CREDIT","ACCOUNTS_PAYABLE"],["2100","Taxes Payable","LIABILITY","CREDIT","TAXES_PAYABLE"],["2200","Loans","LIABILITY","CREDIT","LOANS"],
 ["3000","Owner Capital","EQUITY","CREDIT","OWNER_CAPITAL"],["3100","Drawings","EQUITY","DEBIT","DRAWINGS"],["3200","Retained Earnings","EQUITY","CREDIT","RETAINED_EARNINGS"],["3300","Opening Balance Equity","EQUITY","CREDIT","OPENING_BALANCE_EQUITY"],
 ["4000","Sales / Service Income","INCOME","CREDIT","SALES_INCOME"],["4100","Other Income","INCOME","CREDIT","OTHER_INCOME"],["5000","Purchase / Cost","EXPENSE","DEBIT","PURCHASE_COST"],["5100","General Expenses","EXPENSE","DEBIT","GENERAL_EXPENSES"],
].map(([code,name,accountClass,normalBalance,systemKey])=>({code,name,accountClass:accountClass as LedgerAccountClass,normalBalance:normalBalance as NormalBalanceSide,systemKey,isSystem:true,allowPosting:true}));
