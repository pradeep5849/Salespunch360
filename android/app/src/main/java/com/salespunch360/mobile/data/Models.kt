package com.salespunch360.mobile.data
import kotlinx.serialization.Serializable
@Serializable data class LoginRequest(val identifier:String,val password:String)
@Serializable data class LoginResponse(val accessToken:String,val expiresAt:String,val bootstrap:Bootstrap)
@Serializable data class Bootstrap(val user:MobileUser,val company:CompanyBrand,val teamStructure:TeamStructure=TeamStructure.MANAGERS_AND_SALES,val features:Features,val entitlement:Entitlement,val attendance:Attendance?)
@Serializable data class MobileUser(val id:String,val name:String,val role:MobileRole)
@Serializable enum class MobileRole{COMPANY_ADMIN,MANAGER,SALES}
@Serializable enum class TeamStructure{MANAGERS_AND_SALES,SALES_ONLY}
@Serializable data class CompanyBrand(val name:String,val logoUrl:String?=null)
@Serializable data class Features(val attendanceEnabled:Boolean,val gpsTrackingEnabled:Boolean)
@Serializable data class Entitlement(val state:String,val operationalWritesAllowed:Boolean,val managerLimit:Int=0,val salesLimit:Int=0,val managerUsage:Int=0,val salesUsage:Int=0)
@Serializable data class EmployeeManager(val id:String,val name:String,val isActive:Boolean)
@Serializable data class Employee(val id:String,val name:String,val email:String,val phone:String?=null,val employeeCode:String?=null,val role:MobileRole,val isActive:Boolean,val managerId:String?=null,val manager:EmployeeManager?=null)
@Serializable data class EmployeeEntitlement(val state:String,val operationalWritesAllowed:Boolean,val managerLimit:Int?=null,val salesLimit:Int?=null,val managerUsage:Int,val salesUsage:Int)
@Serializable data class EmployeeContext(val employees:List<Employee>,val teamStructure:TeamStructure,val entitlement:EmployeeEntitlement)
@Serializable data class CreateEmployeeRequest(val role:MobileRole,val name:String,val email:String,val phone:String?=null,val employeeCode:String?=null,val password:String,val confirmPassword:String,val managerId:String?=null)
@Serializable data class EmployeeActiveRequest(val employeeId:String,val isActive:Boolean)
@Serializable data class Attendance(val id:String,val startedAt:String,val endedAt:String?=null)
@Serializable data class AttendanceRequest(val action:String,val location:LocationPayload?=null)
@Serializable data class LocationPayload(val latitude:Double,val longitude:Double,val accuracyMeters:Double?=null,val clientPointId:String?=null,val capturedAt:String?=null)
