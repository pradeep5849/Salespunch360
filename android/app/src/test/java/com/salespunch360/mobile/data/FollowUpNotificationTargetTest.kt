package com.salespunch360.mobile.data
import org.junit.Assert.*
import org.junit.Test
class FollowUpNotificationTargetTest {
 private val id="11111111-1111-4111-8111-111111111111"
 @Test fun retainsTheNotifiedLeadAndOverdueFilter(){assertEquals(FollowUpNotificationTarget("OVERDUE",id),followUpNotificationTarget("/workspace/follow-up-tasks?status=OVERDUE&leadId=$id"))}
 @Test fun doesNotTreatAnExternalLinkAsAnInternalDestination(){assertEquals(FollowUpNotificationTarget(),followUpNotificationTarget("https://example.invalid/workspace/follow-up-tasks?status=OVERDUE&leadId=$id"))}
 @Test fun dropsInvalidLeadAndUnknownStatus(){assertEquals(FollowUpNotificationTarget(),followUpNotificationTarget("/workspace/follow-up-tasks?status=UNKNOWN&leadId=not-a-uuid"))}
}
