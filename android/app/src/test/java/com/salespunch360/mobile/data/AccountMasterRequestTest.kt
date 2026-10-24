package com.salespunch360.mobile.data
import org.junit.Assert.*
import org.junit.Test
class AccountMasterRequestTest {
 @Test fun unsavedBlankOrNullIdsUseCollectionPost(){for(id in listOf(null,"","  "))assertEquals(AccountMasterWriteRequest("api/v1/mobile/account/master-data/customers","POST"),accountMasterWriteRequest("customers",id))}
 @Test fun existingRecordsUsePatchAtTheEncodedIdentity(){assertEquals(AccountMasterWriteRequest("api/v1/mobile/account/master-data/customers/saved%2Fid","PATCH"),accountMasterWriteRequest("customers","saved/id"))}
 @Test fun kindIsEncodedRatherThanCreatingAnotherPath(){assertEquals("api/v1/mobile/account/master-data/a%2Fb",accountMasterWriteRequest("a/b",null).path)}
}
