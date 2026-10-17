package com.salespunch360.mobile.account
import org.junit.Assert.*
import org.junit.Test
class ChequeFeedbackTest {
 @Test fun correctionAndConcurrencyErrorsTellTheUserWhatToDo(){assertEquals("The correction date cannot be before the original payment date.",chequeErrorMessage("INVALID_CHEQUE_CORRECTION_DATE"));assertTrue(chequeErrorMessage("CHEQUE_CHANGED").contains("Refresh"));assertTrue(chequeErrorMessage("LEGACY_CHEQUE_SOURCE_REQUIRED").contains("Complete"))}
 @Test fun deniedAndUnexpectedResponsesDoNotExposeRawServerCodes(){assertTrue(chequeErrorMessage("MOBILE_FORBIDDEN").contains("permission"));assertTrue(chequeErrorMessage(null).contains("connection"));assertFalse(chequeErrorMessage("PRISMA_INTERNAL_EXCEPTION").contains("PRISMA"))}
}
