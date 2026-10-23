package com.salespunch360.mobile.account
import org.junit.Test
import org.junit.Assert.*
import kotlinx.serialization.json.*
class PartyTransferDraftTest{
 @Test fun netCommissionAndEqualPassThrough(){assertEquals("100.00",partyTransferCommission("600","500"));assertEquals("0.00",partyTransferCommission("800","800"));assertEquals("0.01",partyTransferCommission("9999999999999999.99","9999999999999999.98"))}
 @Test fun rejectsOverpaidAndInvalidPrecision(){for(pair in listOf("500" to "600","0" to "0","1.001" to "1","-1" to "0")){assertTrue(runCatching{partyTransferCommission(pair.first,pair.second)}.isFailure)}}
 @Test fun requestPreservesCanonicalPartiesAndStableIdentity(){val key="11111111-1111-4111-8111-111111111111";val a="22222222-2222-4222-8222-222222222222";val b="33333333-3333-4333-8333-333333333333";val row=partyTransferDocument(key,a,b,"2026-10-23","CUSTOMER:$a","VENDOR:$b","600","500","Commission");assertEquals(key,row["requestKey"]!!.jsonPrimitive.content);assertEquals("CUSTOMER",row["receivedParty"]!!.jsonObject["kind"]!!.jsonPrimitive.content);assertNull(row["commissionAmount"]);assertNull(row["companyId"])}
}
