package com.salespunch360.mobile.account
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
class ExpenseLegacyJsonTest {
 @Test fun nullableLegacyBilledItemsRemainReadable(){val x=buildJsonObject{put("billedItems",JsonNull)};assertTrue(x.array("billedItems").isEmpty())}
 @Test fun objectListsAreScopedToObjects(){val x=buildJsonObject{put("billedItems",buildJsonArray{add(buildJsonObject{put("name","Office")});add(JsonNull)})};assertEquals(1,x.array("billedItems").size)}
}
