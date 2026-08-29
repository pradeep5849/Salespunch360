package com.salespunch360.mobile
import com.salespunch360.mobile.data.MobileRole
import com.salespunch360.mobile.location.TrackingState
import org.junit.Assert.*
import org.junit.Test
class FoundationTest{
 @Test fun `super admin has no mobile role`(){assertFalse(MobileRole.entries.any{it.name=="SUPER_ADMIN"})}
 @Test fun `company admin navigation excludes field check in`(){assertFalse(RoleNavigation.destinations(MobileRole.COMPANY_ADMIN).contains("Check-in / Checkout"));assertTrue(RoleNavigation.destinations(MobileRole.COMPANY_ADMIN).contains("Billing / Subscription"))}
 @Test fun `sales navigation excludes administration`(){val nav=RoleNavigation.destinations(MobileRole.SALES);assertFalse(nav.contains("Employees"));assertFalse(nav.contains("Billing / Subscription"));assertTrue(nav.contains("Check-in / Checkout"))}
 @Test fun `gps states describe honest service conditions`(){assertEquals(10,TrackingState.entries.size);assertEquals("Tracking active",TrackingState.ACTIVE.label);assertTrue(TrackingState.OFFLINE.label.contains("waiting to sync"))}
}
