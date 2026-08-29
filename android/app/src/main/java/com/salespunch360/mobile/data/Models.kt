package com.salespunch360.mobile.data
import kotlinx.serialization.Serializable
@Serializable data class LoginRequest(val identifier:String,val password:String)
@Serializable data class LoginResponse(val accessToken:String,val expiresAt:String,val bootstrap:Bootstrap)
@Serializable data class Bootstrap(val user:MobileUser,val company:CompanyBrand,val features:Features,val entitlement:Entitlement,val attendance:Attendance?)
@Serializable data class MobileUser(val id:String,val name:String,val role:MobileRole)
@Serializable enum class MobileRole{COMPANY_ADMIN,MANAGER,SALES}
@Serializable data class CompanyBrand(val name:String,val logoUrl:String?=null)
@Serializable data class Features(val attendanceEnabled:Boolean,val gpsTrackingEnabled:Boolean)
@Serializable data class Entitlement(val state:String,val operationalWritesAllowed:Boolean)
@Serializable data class Attendance(val id:String,val startedAt:String,val endedAt:String?=null)
@Serializable data class AttendanceRequest(val action:String,val location:LocationPayload?=null)
@Serializable data class LocationPayload(val latitude:Double,val longitude:Double,val accuracyMeters:Double?=null,val clientPointId:String?=null,val capturedAt:String?=null)
