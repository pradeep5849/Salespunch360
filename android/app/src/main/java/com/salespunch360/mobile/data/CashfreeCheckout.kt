package com.salespunch360.mobile.data

import java.net.URLEncoder

/** Session stays in the fragment, outside server logs, referrers and analytics URLs. */
fun cashfreeCheckoutUrl(session:String):String {
 require(session.isNotBlank()&&session.length<=2048){"Invalid payment session"}
 return "https://www.salespunch360.com/payment/checkout#session="+URLEncoder.encode(session,"UTF-8")
}
