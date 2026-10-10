package com.salespunch360.mobile.ui
import org.junit.Assert.*
import org.junit.Test
class PublicPagesTest {
 @Test fun publicDestinationsUseConfiguredOrigin(){assertEquals("https://www.salespunch360.com/privacy",publicPageUrl("https://www.salespunch360.com/","/privacy"));assertTrue(publicPagePaths.containsAll(listOf("/help","/blog","/contact","/terms","/android")))}
 @Test fun arbitraryPathsCannotBeInjected(){for(path in listOf("//example.com","https://example.com","/workspace/account","/api/v1/mobile")){try{publicPageUrl("https://www.salespunch360.com/",path);fail("Unsafe path accepted")}catch(_:IllegalArgumentException){}}}
}
