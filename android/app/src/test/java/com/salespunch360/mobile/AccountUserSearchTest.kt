package com.salespunch360.mobile

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class AccountUserSearchTest {
 private val user=buildJsonObject{put("name","Asha Kumar");put("email","asha@example.invalid");put("phone","9988776655");put("accountRole","ACCOUNT_ADMIN");put("id","private-id");put("passwordHash","secret-value")}
 @Test fun matchesDirectoryTerms(){assertTrue(accountUserMatches(user," ASHA admin "));assertTrue(accountUserMatches(user,"9988"));assertTrue(accountUserMatches(user,"example.invalid"));assertTrue(accountUserMatches(user," "));assertFalse(accountUserMatches(user,"missing"))}
 @Test fun excludesPrivateAndNestedFields(){assertFalse(accountUserMatches(user,"secret-value"));assertFalse(accountUserMatches(user,"private-id"));assertFalse(accountUserMatches(buildJsonObject{put("name",JsonNull);putJsonObject("settings"){put("name","hidden")}},"hidden"))}
}
