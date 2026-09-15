package com.salespunch360.mobile

import com.salespunch360.mobile.data.*
import org.junit.Assert.*
import org.junit.Test

class F3MCorrectionTest {
 private fun employee(active:Boolean=true,salesActive:Boolean=true,role:MobileRole=MobileRole.SALES)=Employee("id","User","u@example.com",role=role,isActive=active,salesAccessActive=salesActive)
 @Test fun `only 401 invalidates general mobile session`(){var invalidations=0;invalidateOnUnauthorized(401){invalidations++};invalidateOnUnauthorized(401){invalidations++};invalidateOnUnauthorized(403){invalidations++};invalidateOnUnauthorized(409){invalidations++};assertEquals(2,invalidations)}
 @Test fun `employee lifecycle labels and actions are canonical`(){assertEquals("Active",employeeStatus(employee()));assertEquals("Deactivate employee",employeeAction(employee()));assertEquals("Sales access suspended",employeeStatus(employee(salesActive=false)));assertEquals("Restore Sales access",employeeAction(employee(salesActive=false)));assertEquals("Inactive identity",employeeStatus(employee(active=false,salesActive=false)));assertEquals("Reactivate identity",employeeAction(employee(active=false,salesActive=false)))}
 @Test fun `active semantics and manager picker exclude Sales suspension`(){assertFalse(isActiveEmployee(employee(salesActive=false)));assertFalse(selectableManagers(listOf(employee(salesActive=false,role=MobileRole.MANAGER))).isNotEmpty());assertEquals(1,selectableManagers(listOf(employee(role=MobileRole.MANAGER),employee(active=false,role=MobileRole.MANAGER))).size)}
 @Test fun `home seats include primary and additional admin for sales only`(){val lines=seatSummaryLines(Entitlement("PAID",true,2,1,3,5,1,4),TeamStructure.SALES_ONLY);assertTrue(lines.any{it.contains("Primary Admin")&&it.contains("Included / Free")});assertTrue(lines.any{it.contains("Additional Admin")});assertFalse(lines.any{it.startsWith("Manager")});assertTrue(lines.any{it.startsWith("Sales")})}
 @Test fun `pricing includes canonical billable roles by structure`(){assertEquals(setOf("ADMIN","SALES"),visiblePricingRoles(TeamStructure.SALES_ONLY));assertEquals(setOf("ADMIN","MANAGER","SALES"),visiblePricingRoles(TeamStructure.MANAGERS_AND_SALES))}
}
