package com.salespunch360.mobile.data

/** Checkout submits the reviewed intent, including whether capacity buys a new term. */
internal fun onlineOrderFromQuote(q:BillingQuote,key:String)=OnlineOrderRequest(
 purchaseMode=q.purchaseMode,kind=q.kind,billingPeriod=q.billingPeriod,
 adminSeats=q.adminSeats,managerSeats=q.managerSeats,salesSeats=q.salesSeats,
 telecallerSeats=q.telecallerSeats,accountPackages=q.accountPackages,
 quantity=if(q.kind=="ACCOUNT_PACKAGE")q.quantity else null,
 retainAdminUserIds=q.retainAdminUserIds,retainManagerUserIds=q.retainManagerUserIds,
 retainSalesUserIds=q.retainSalesUserIds,idempotencyKey=key
)
