package com.salespunch360.mobile.account
fun accountNotificationCategory(type:String):String=if(type in setOf("EXPENSE_APPROVAL","SERVICE_REMINDER","PAYMENT_REMINDER"))"TRANSACTIONS"else "APP"
