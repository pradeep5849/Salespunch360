package com.salespunch360.mobile.data
import org.junit.Assert.*
import org.junit.Test
class TelecallerEmployeePolicyTest {
 private fun employee(designation:String?,active:Boolean=true)=Employee(id="id",name="Caller",email="caller@example.invalid",designation=designation,role=MobileRole.SALES,isActive=active,salesAccessActive=false)
 @Test fun activeTelecallerDoesNotNeedFieldSalesAccess(){val user=employee(" Telecaller ");assertTrue(isTelecallerEmployee(user));assertTrue(isActiveEmployee(user));assertEquals("Active Telecaller",employeeStatus(user));assertEquals("Deactivate Telecaller",employeeAction(user))}
 @Test fun inactiveTelecallerUsesTelecallerReactivation(){val user=employee("Telecaller",false);assertFalse(isActiveEmployee(user));assertEquals("Reactivate Telecaller",employeeAction(user))}
 @Test fun ordinarySuspendedSalesKeepsItsDistinctStatus(){val user=employee(null);assertFalse(isTelecallerEmployee(user));assertFalse(isActiveEmployee(user));assertEquals("Restore Sales access",employeeAction(user))}
}
