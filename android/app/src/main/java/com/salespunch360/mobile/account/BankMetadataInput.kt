package com.salespunch360.mobile.account
private val ifscPattern=Regex("^[A-Z]{4}0[A-Z0-9]{6}$",RegexOption.IGNORE_CASE)
private val upiPattern=Regex("^[A-Za-z0-9_.-]{2,256}@[A-Za-z]{2,64}$")
data class BankMetadataErrors(val bankName:String?=null,val holder:String?=null,val branch:String?=null,val ifsc:String?=null,val upi:String?=null){val valid:Boolean get()=listOf(bankName,holder,branch,ifsc,upi).all{it==null}}
fun bankMetadataErrors(bankName:String,holder:String,branch:String,ifsc:String,upi:String,printQr:Boolean):BankMetadataErrors=BankMetadataErrors(
 bankName=if(bankName.length>160)"Use no more than 160 characters."else null,
 holder=if(holder.length>160)"Use no more than 160 characters."else null,
 branch=if(branch.length>160)"Use no more than 160 characters."else null,
 ifsc=if(ifsc.isNotBlank()&&!ifscPattern.matches(ifsc))"Enter four bank letters, 0 and six branch characters."else null,
 upi=if(printQr&&upi.isBlank())"Enter a UPI ID to print the payment QR."else if(upi.isNotBlank()&&!upiPattern.matches(upi))"Enter a valid UPI ID, such as name@bank."else null,
)
