import {it,expect} from "vitest";
import {ACCOUNT_NOTIFICATION_TABS,accountNotificationCategory} from "./notification-tabs";
it("preserves the two reference tabs without interpreting transactions as a ledger",()=>{expect(ACCOUNT_NOTIFICATION_TABS.map(x=>x.label)).toEqual(["App Notifications","All Transactions"]);for(const type of ["EXPENSE_APPROVAL","SERVICE_REMINDER","PAYMENT_REMINDER"])expect(accountNotificationCategory(type)).toBe("TRANSACTIONS")});
it("keeps backup and unknown app alerts outside the transaction tab",()=>{for(const type of ["BACKUP_REMINDER","","APP_UPDATE"])expect(accountNotificationCategory(type)).toBe("APP")});
