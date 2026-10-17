package com.salespunch360.mobile.account
import com.salespunch360.mobile.data.ApiException
import java.io.IOException
import org.junit.Assert.*
import org.junit.Test
class MoneyMutationFeedbackTest {
 @Test fun offlineRetainsDraftWithoutClaimingNoWriteOccurred(){val text=moneyMutationFeedback(IOException("private network error"));assertTrue(text.contains("No cash/bank change was confirmed"));assertTrue(text.contains("retained"));assertFalse(text.contains("private network error"))}
 @Test fun validationUsesSafeServerFieldHelp(){assertEquals("Enter a reason with at least three characters.",moneyMutationFeedback(ApiException(400,"INVALID_INPUT",serverMessage="Enter a reason with at least three characters.")))}
 @Test fun accessAndSessionFailuresAreActionable(){assertTrue(moneyMutationFeedback(ApiException(403)).contains("not authorized"));assertTrue(moneyMutationFeedback(ApiException(401)).contains("Sign in again"))}
 @Test fun unknownExceptionsDoNotExposePrivateDetails(){assertFalse(moneyMutationFeedback(IllegalArgumentException("private SQL detail")).contains("private SQL detail"));assertTrue(moneyMutationFeedback(ApiException(400,"INVALID_INPUT")).contains("Check the entered details"))}
}
