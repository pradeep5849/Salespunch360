package com.salespunch360.mobile.data
fun billingQuoteFailureMessage(code:String?):String=when(code){
 "SEATS_BELOW_USAGE","TELECALLER_SEATS_BELOW_USAGE"->"Keep enough seats for active users, or deactivate users before reducing capacity. Your selection has been kept."
 "PRICING_UNAVAILABLE"->"Current pricing is unavailable. Keep your selection and retry shortly."
 "MANAGERS_DISABLED"->"Manager seats are unavailable for this company’s selected team structure."
 "INVALID_INPUT","INVALID_SEAT_SELECTION"->"Review the seat counts and retained users, then retry. Your selection has been kept."
 else->"The quote could not be loaded. Your selection has been kept; check your connection and retry."
}
