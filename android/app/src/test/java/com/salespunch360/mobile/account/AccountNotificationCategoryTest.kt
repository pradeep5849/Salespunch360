package com.salespunch360.mobile.account
import org.junit.Assert.*
import org.junit.Test
class AccountNotificationCategoryTest{
 @Test fun onlyTransactionAlertsEnterTransactionTab(){for(type in listOf("EXPENSE_APPROVAL","SERVICE_REMINDER","PAYMENT_REMINDER"))assertEquals("TRANSACTIONS",accountNotificationCategory(type))}
 @Test fun appAndBackupAlertsStaySeparate(){for(type in listOf("BACKUP_REMINDER","APP_UPDATE",""))assertEquals("APP",accountNotificationCategory(type))}
}
