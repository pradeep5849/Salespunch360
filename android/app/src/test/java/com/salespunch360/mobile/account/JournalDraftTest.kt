package com.salespunch360.mobile.account
import com.salespunch360.mobile.JournalDraft
import org.junit.Assert.*
import org.junit.Test
class JournalDraftTest {
 @Test fun editingAndRetryKeepTheSamePostingIdentity(){val first=JournalDraft();val edited=first.copy(reference="Invoice",lines=first.lines+com.salespunch360.mobile.JournalLineDraft());assertEquals(first.requestKey,edited.requestKey);assertNotEquals(first.requestKey,JournalDraft().requestKey);assertEquals(3,edited.lines.size)}
}
