package com.salespunch360.mobile
import com.salespunch360.mobile.data.MobileRole
import com.salespunch360.mobile.data.TeamStructure
import com.salespunch360.mobile.location.TrackingState
import com.salespunch360.mobile.ui.RoleNavigation
import org.junit.Assert.*
import org.junit.Test
class FoundationTest{
 @Test fun `super admin has no mobile role`(){assertFalse(MobileRole.entries.any{it.name=="SUPER_ADMIN"})}
 @Test fun `company admin primary navigation is exact`(){assertEquals(listOf("Home","Employees","Reports","More"),RoleNavigation.destinations(MobileRole.COMPANY_ADMIN).map{it.label})}
 @Test fun `manager primary navigation is exact`(){assertEquals(listOf("Home","Team","Reports","More"),RoleNavigation.destinations(MobileRole.MANAGER).map{it.label})}
 @Test fun `sales primary navigation is exact`(){assertEquals(listOf("Home","Customers","Leads","More"),RoleNavigation.destinations(MobileRole.SALES).map{it.label})}
 @Test fun `older bootstrap compatibility defaults team structure`(){assertEquals(TeamStructure.MANAGERS_AND_SALES,TeamStructure.valueOf("MANAGERS_AND_SALES"))}
 @Test fun `gps states describe honest service conditions`(){assertEquals(10,TrackingState.entries.size);assertEquals("Tracking active",TrackingState.ACTIVE.label);assertTrue(TrackingState.OFFLINE.label.contains("waiting to sync"))}
 @Test fun `checkout sentiments match server contract`(){assertEquals(listOf("POSITIVE","NEUTRAL","NEGATIVE"),com.salespunch360.mobile.data.VisitSentiment.entries.map{it.name})}
 @Test fun `api errors are safe and actionable`(){assertEquals("You don't have permission for this action.",apiMessage(com.salespunch360.mobile.data.ApiException(403),"fallback"));assertEquals("This record changed. Refresh and try again.",apiMessage(com.salespunch360.mobile.data.ApiException(409,"STALE"),"fallback"))}
 @Test fun `queued points are owned by one authenticated user`(){val point=com.salespunch360.mobile.data.PendingLocation("id","user-a",1.0,2.0,3.0,"2026-01-01T00:00:00Z");assertEquals("user-a",point.ownerUserId)}
 @Test fun `lead stages match server pipeline contract`(){assertEquals(listOf("NEW","QUALIFIED","PROPOSAL","NEGOTIATION","WON","LOST"),com.salespunch360.mobile.data.LeadStage.entries.map{it.name})}
}
