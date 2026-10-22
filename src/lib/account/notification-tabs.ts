export const ACCOUNT_NOTIFICATION_TABS=[{id:"APP",label:"App Notifications"},{id:"TRANSACTIONS",label:"All Transactions"}] as const;
export type AccountNotificationTab=typeof ACCOUNT_NOTIFICATION_TABS[number]["id"];
/** This tab contains alerts about transactions, never the transaction ledger itself. */
export function accountNotificationCategory(type:string):AccountNotificationTab{
 return ["EXPENSE_APPROVAL","SERVICE_REMINDER","PAYMENT_REMINDER"].includes(type)?"TRANSACTIONS":"APP";
}
