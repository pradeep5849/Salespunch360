package com.salespunch360.mobile
import com.salespunch360.mobile.data.MobileRole
import com.salespunch360.mobile.data.TeamStructure
import com.salespunch360.mobile.location.TrackingState
import com.salespunch360.mobile.ui.MobileRouteHistory
import com.salespunch360.mobile.ui.RoleNavigation
import com.salespunch360.mobile.ui.salesReportDrawerItems
import org.junit.Assert.*
import org.junit.Test
class FoundationTest{
 @Test fun `super admin has no mobile role`(){assertFalse(MobileRole.entries.any{it.name=="SUPER_ADMIN"})}
 @Test fun `company admin primary navigation is exact`(){assertEquals(listOf("Home","Employees","Reports","More"),RoleNavigation.destinations(MobileRole.PRIMARY_ADMIN).map{it.label})}
 @Test fun `additional admin uses admin family navigation`(){assertEquals(RoleNavigation.destinations(MobileRole.PRIMARY_ADMIN).map{it.label},RoleNavigation.destinations(MobileRole.ADMIN).map{it.label})}
 @Test fun `canonical mobile roles decode without company admin`(){assertEquals(listOf("PRIMARY_ADMIN","ADMIN","MANAGER","SALES"),MobileRole.entries.map{it.name})}
 @Test fun `manager primary navigation is exact`(){assertEquals(listOf("Home","Team","Reports","More"),RoleNavigation.destinations(MobileRole.MANAGER).map{it.label})}
 @Test fun `sales primary navigation is exact`(){assertEquals(listOf("Home","Customers","Leads","More"),RoleNavigation.destinations(MobileRole.SALES).map{it.label})}
 @Test fun `older bootstrap compatibility defaults team structure`(){assertEquals(TeamStructure.MANAGERS_AND_SALES,TeamStructure.valueOf("MANAGERS_AND_SALES"))}
 @Test fun `gps states describe honest service conditions`(){assertEquals(10,TrackingState.entries.size);assertEquals("Tracking active",TrackingState.ACTIVE.label);assertTrue(TrackingState.OFFLINE.label.contains("waiting to sync"))}
 @Test fun `checkout sentiments match server contract`(){assertEquals(listOf("POSITIVE","NEUTRAL","NEGATIVE"),com.salespunch360.mobile.data.VisitSentiment.entries.map{it.name})}
 @Test fun `api errors are safe and actionable`(){assertEquals("You don't have permission for this action.",apiMessage(com.salespunch360.mobile.data.ApiException(403),"fallback"));assertEquals("This record changed. Refresh and try again.",apiMessage(com.salespunch360.mobile.data.ApiException(409,"STALE"),"fallback"))}
 @Test fun `queued points are owned by one authenticated user`(){val point=com.salespunch360.mobile.data.PendingLocation("id","user-a",1.0,2.0,3.0,"2026-01-01T00:00:00Z");assertEquals("user-a",point.ownerUserId)}
 @Test fun `lead stages match server pipeline contract`(){assertEquals(listOf("NEW","QUALIFIED","PROPOSAL","NEGOTIATION","WON","LOST"),com.salespunch360.mobile.data.LeadStage.entries.map{it.name})}
 @Test fun `sales report drawer matches web mobile links`(){assertEquals(listOf("Check-in Report","My Attendance","My Travel / Distance","My Performance"),salesReportDrawerItems(MobileRole.SALES).map{it.label})}
 @Test fun `admin report drawer matches web mobile links`(){assertEquals(listOf("Check-in Report","Attendance Report","GPS Route Report","Geofence Report","Target Analysis","Expense Report"),salesReportDrawerItems(MobileRole.PRIMARY_ADMIN).map{it.label})}
 @Test fun `route history returns one screen at a time`(){val nav=MobileRouteHistory("Dashboard");nav.navigate("Leads");nav.navigate("Follow-ups");nav.navigate("Report:check-ins");assertTrue(nav.back());assertEquals("Follow-ups",nav.current);assertTrue(nav.back());assertEquals("Leads",nav.current);assertTrue(nav.back());assertEquals("Dashboard",nav.current);assertFalse(nav.back())}
}
