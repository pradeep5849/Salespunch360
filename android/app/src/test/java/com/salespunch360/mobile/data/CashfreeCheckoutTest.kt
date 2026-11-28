package com.salespunch360.mobile.data
import org.junit.Assert.*
import org.junit.Test
import java.net.URI
class CashfreeCheckoutTest {
 @Test fun canonicalCheckoutKeepsSessionOutOfQueryAndPath(){
  val uri=URI(cashfreeCheckoutUrl("fixture+session/with=characters"))
  assertEquals("https",uri.scheme);assertEquals("www.salespunch360.com",uri.host)
  assertEquals("/payment/checkout",uri.path);assertNull(uri.query)
  assertTrue(uri.rawFragment.startsWith("session=fixture%2Bsession%2F"))
 }
 @Test fun sessionCannotChangeDestination(){assertEquals("www.salespunch360.com",URI(cashfreeCheckoutUrl("https://untrusted.invalid/#payload")).host)}
 @Test(expected=IllegalArgumentException::class) fun rejectsBlankSession(){cashfreeCheckoutUrl(" ")}
 @Test(expected=IllegalArgumentException::class) fun rejectsOversizedSession(){cashfreeCheckoutUrl("a".repeat(2049))}
}
