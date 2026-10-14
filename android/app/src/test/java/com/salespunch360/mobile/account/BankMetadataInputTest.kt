package com.salespunch360.mobile.account
import org.junit.Assert.*
import org.junit.Test
class BankMetadataInputTest {
 @Test fun optionalBankDataAndIndependentQr(){assertTrue(bankMetadataErrors("","","","","",false).valid);assertTrue(bankMetadataErrors("Bank","Holder","Branch","SBIN0001234","holder@bank",true).valid);assertNotNull(bankMetadataErrors("","","","","",true).upi)}
 @Test fun rejectsMalformedIdentifiers(){assertNotNull(bankMetadataErrors("","","","BAD","holder@bank",false).ifsc);assertNotNull(bankMetadataErrors("","","","SBIN1001234","holder@bank",false).ifsc);assertNotNull(bankMetadataErrors("","","","","invalid",false).upi);assertNotNull(bankMetadataErrors("","","","","name@bank?amount=99",false).upi)}
 @Test fun metadataLengthsMatchServer(){val errors=bankMetadataErrors("a".repeat(161),"a".repeat(161),"a".repeat(161),"","",false);assertFalse(errors.valid);assertNotNull(errors.bankName);assertNotNull(errors.holder);assertNotNull(errors.branch)}
}
