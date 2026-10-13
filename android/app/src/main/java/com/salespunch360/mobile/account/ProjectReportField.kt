package com.salespunch360.mobile.account

enum class ProjectReportFieldType { MONEY, DATE, TEXT }
fun projectReportFieldType(field:String):ProjectReportFieldType = when(field) {
    "amount", "cost", "taxableAmount", "taxAmount", "totalAmount", "remainingAmount",
    "revenue", "tax", "total", "outstanding" -> ProjectReportFieldType.MONEY
    "date" -> ProjectReportFieldType.DATE
    else -> ProjectReportFieldType.TEXT
}
