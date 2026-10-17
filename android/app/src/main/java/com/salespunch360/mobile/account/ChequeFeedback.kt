package com.salespunch360.mobile.account

fun chequeErrorMessage(code:String?):String=when(code){
 "CHEQUE_CHANGED"->"This cheque changed. Refresh before closing or reopening it."
 "CHEQUE_NOT_DUE"->"The closure date cannot be before the cheque date."
 "INVALID_CHEQUE_CORRECTION_DATE"->"The correction date cannot be before the original payment date."
 "INVALID_CHEQUE_TRANSITION"->"This action is no longer available. Refresh the cheque."
 "LEGACY_CHEQUE_SOURCE_REQUIRED"->"Complete the original amount and payment source before changing this cheque."
 "INVALID_CHEQUE_SOURCE"->"The payment source is inconsistent. Refresh or complete its source details."
 "CHEQUE_NUMBER_EXISTS"->"This cheque number already exists for this bank account."
 "INSUFFICIENT_FUNDS"->"The selected account has insufficient funds for this payment."
 "MOBILE_FORBIDDEN","NOT_AUTHORIZED","FORBIDDEN"->"Your permission or branch access does not allow this action."
 else->"Cheque could not be saved. Check the details and connection, then retry."
}
