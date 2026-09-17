package com.salespunch360.mobile.data
import kotlinx.serialization.Serializable
@Serializable data class LoginRequest(val identifier:String,val password:String)
@Serializable data class LoginResponse(val accessToken:String,val expiresAt:String,val bootstrap:Bootstrap)
@Serializable data class Bootstrap(
 val user:MobileUser,
 val company:CompanyBrand,
 val teamStructure:TeamStructure=TeamStructure.MANAGERS_AND_SALES,
 val features:Features,
 val capabilities:Capabilities=Capabilities(),
 val entitlement:Entitlement,
 val attendance:Attendance?,
 val productEdition:ProductEdition,
 val authorizedWorkspaces:List<Workspace>,
 val canSwitchWorkspace:Boolean,
 val salesDashboard:SalesDashboard?=null
)
@Serializable data class SalesDashboard(val todayVisitCount:Int=0,val todayLeadCount:Int=0,val monthVisitCount:Int=0,val monthLeadCount:Int=0,val pendingTodayTasks:Int=0,val overdueTasks:Int=0,val recentVisits:List<DashboardVisit> = emptyList())
@Serializable data class DashboardVisit(val id:String,val contactName:String?=null,val checkedInAt:String,val checkedOutAt:String?=null,val checkInAddress:String?=null,val checkoutSentiment:String?=null,val customerName:String?=null)
@Serializable data class MobileUser(val id:String,val name:String,val email:String?=null,val salesRole:MobileRole?=null,val accountRole:AccountRole?=null)
@Serializable enum class MobileRole{PRIMARY_ADMIN,ADMIN,MANAGER,SALES}
@Serializable enum class AccountRole{ACCOUNT_ADMIN,ACCOUNTANT,PROJECT_MANAGER,DATA_ENTRY}
@Serializable enum class ProductEdition{SALESPUNCH360,SALESPUNCH360_ACCOUNT,SALESPUNCH360_PLUS}
@Serializable enum class Workspace{SALES,ACCOUNT}
@Serializable data class WebSessionRequest(val redirectPath:String="/workspace/account")
@Serializable data class WebSessionHandoff(val handoffCode:String,val expiresAt:String)
@Serializable enum class TeamStructure{MANAGERS_AND_SALES,SALES_ONLY}
@Serializable data class CompanyBrand(val name:String,val logoUrl:String?=null,val address:String?=null)
@Serializable data class PasswordChangeRequest(val currentPassword:String,val newPassword:String,val confirmPassword:String)
@Serializable data class Features(val attendanceEnabled:Boolean,val gpsTrackingEnabled:Boolean,val fieldWorkEnabled:Boolean=false)
@Serializable data class Capabilities(val canManageEmployees:Boolean=false,val canManageSalesSettings:Boolean=false,val canAccessSalesBilling:Boolean=false,val canViewReports:Boolean=false)
@Serializable data class Entitlement(val state:String,val operationalWritesAllowed:Boolean,val adminLimit:Int=0,val adminUsage:Int=0,val managerLimit:Int=0,val salesLimit:Int=0,val managerUsage:Int=0,val salesUsage:Int=0)
@Serializable data class CompanySettings(val name:String,val teamStructure:TeamStructure,val subscriptionStatus:String,val trialStartedAt:String?=null,val trialEndsAt:String?=null,val attendanceEnabled:Boolean,val gpsTrackingEnabled:Boolean,val checkoutRequiredBeforeNextCheckIn:Boolean,val attendanceGeofenceEnabled:Boolean,val attendanceReferenceLatitude:String?=null,val attendanceReferenceLongitude:String?=null,val attendanceGeofenceRadiusMeters:Int?=null,val customerCheckInGeofenceEnabled:Boolean,val customerCheckInGeofenceRadiusMeters:Int?=null)
@Serializable data class ActiveSubscription(val billingPeriod:String,val adminSeats:Int=0,val managerSeats:Int,val salesSeats:Int,val startsAt:String,val endsAt:String,val status:String)
@Serializable data class CompanyEntitlement(val trialActive:Boolean,val paidActive:Boolean,val state:String,val adminLimit:Int=0,val adminUsage:Int=0,val managerLimit:Int,val salesLimit:Int,val managerUsage:Int,val salesUsage:Int,val operationalWritesAllowed:Boolean,val subscription:ActiveSubscription?=null)
@Serializable data class BillingPrice(val id:String,val role:String,val period:String,val amount:String,val currency:String)
@Serializable data class CompanyContext(val company:CompanySettings,val entitlement:CompanyEntitlement,val prices:List<BillingPrice>,val paymentProvider:String,val paymentMessage:String)
@Serializable data class OperationsSettings(val attendanceEnabled:Boolean,val gpsTrackingEnabled:Boolean,val checkoutRequiredBeforeNextCheckIn:Boolean)
@Serializable data class GeofenceSettings(val attendanceGeofenceEnabled:Boolean,val attendanceReferenceLatitude:String?=null,val attendanceReferenceLongitude:String?=null,val attendanceGeofenceRadiusMeters:Int?=null,val customerCheckInGeofenceEnabled:Boolean,val customerCheckInGeofenceRadiusMeters:Int?=null)
@Serializable data class CompanyUpdateRequest<T>(val section:String,val data:T)
@Serializable data class TargetPerson(val id:String?=null,val name:String,val role:String?=null)
@Serializable data class SalesTarget(val id:String,val assignedUserId:String,val assignedUser:TargetPerson,val metric:String,val periodType:String,val startDate:String,val endDate:String,val targetValue:String,val currencyCode:String,val version:Int,val actual:String,val remaining:String,val percentage:Double,val status:String)
@Serializable data class TargetOption(val id:String,val name:String,val role:String)
@Serializable data class TargetsContext(val targets:List<SalesTarget>,val options:List<TargetOption>)
@Serializable data class TargetRequest(val assignedUserId:String,val metric:String,val periodType:String,val startDate:String,val endDate:String,val targetValue:String,val currencyCode:String="INR")
@Serializable data class EditTargetRequest(val targetId:String,val version:Int,val assignedUserId:String,val metric:String,val periodType:String,val startDate:String,val endDate:String,val targetValue:String,val currencyCode:String="INR")
@Serializable data class EmployeeManager(val id:String,val name:String,val isActive:Boolean,val salesAccessActive:Boolean)
@Serializable data class Employee(val id:String,val name:String,val email:String,val phone:String?=null,val employeeCode:String?=null,val role:MobileRole,val isActive:Boolean,val salesAccessActive:Boolean,val managerId:String?=null,val manager:EmployeeManager?=null)
@Serializable data class EmployeeEntitlement(val state:String,val operationalWritesAllowed:Boolean,val managerLimit:Int?=null,val salesLimit:Int?=null,val managerUsage:Int,val salesUsage:Int)
@Serializable data class EmployeeContext(val employees:List<Employee>,val teamStructure:TeamStructure,val entitlement:EmployeeEntitlement)
@Serializable data class CreateEmployeeRequest(val role:MobileRole,val name:String,val email:String,val phone:String?=null,val employeeCode:String?=null,val password:String,val confirmPassword:String,val managerId:String?=null)
@Serializable data class EmployeeActiveRequest(val employeeId:String,val isActive:Boolean)
@Serializable data class Customer(val id:String,val name:String,val contactPerson:String?=null,val phone:String?=null,val email:String?=null,val address:String?=null,val latitude:Double?=null,val longitude:Double?=null,val checkInReferenceSetAt:String?=null)
@Serializable enum class VisitSentiment{POSITIVE,NEUTRAL,NEGATIVE}
@Serializable data class FieldVisit(val id:String,val checkedInAt:String,val checkedOutAt:String?=null,val visitNotes:String?=null,val checkoutSentiment:VisitSentiment?=null,val checkoutRemarks:String?=null,val leadCount:Int=0,val contactName:String?=null,val leadId:String?=null,val visitType:String="CUSTOMER",val customer:Customer?=null)
@Serializable data class FieldContext(val customers:List<Customer>,val visits:List<FieldVisit>)
@Serializable data class FollowUpsContext(val status:String,val tasks:List<FollowUpTask>)
@Serializable data class FollowUpTask(val id:String,val status:String,val dueDate:String,val notes:String?=null,val leadId:String,val leadTitle:String,val subjectName:String,val completedVisitId:String?=null,val checkedInAt:String?=null,val checkedOutAt:String?=null,val canStartCheckIn:Boolean=false)
@Serializable data class CheckInRequest(val action:String="CHECK_IN",val customerId:String,val location:LocationPayload,val visitNotes:String?=null)
@Serializable data class CheckoutRequest(val action:String="CHECK_OUT",val visitId:String,val location:LocationPayload,val sentiment:VisitSentiment,val remarks:String?=null)
@Serializable enum class LeadStage{NEW,QUALIFIED,PROPOSAL,NEGOTIATION,WON,LOST}
@Serializable data class LeadPerson(val id:String?=null,val name:String)
@Serializable data class LeadActivity(val id:String,val type:String,val fromStage:LeadStage?=null,val toStage:LeadStage?=null,val previousAssignedUserId:String?=null,val newAssignedUserId:String?=null,val createdAt:String,val actorUser:LeadPerson)
@Serializable data class LeadSummary(val id:String,val title:String,val stage:LeadStage,val source:String,val version:Int,val companyName:String?=null,val contactName:String?=null,val phone:String?=null,val email:String?=null,val followUpAt:String?=null,val notes:String?=null,val lostReason:String?=null,val assignedUserId:String,val assignedUser:LeadPerson,val customer:LeadPerson?=null,val sourceVisitId:String?=null,val estimatedValue:String?=null,val currencyCode:String="INR",val activities:List<LeadActivity> = emptyList())
@Serializable data class LeadFromVisitRequest(val action:String="FROM_VISIT",val visitId:String,val title:String,val contactName:String?=null,val phone:String?=null,val companyName:String?=null,val currencyCode:String="INR")
@Serializable data class LeadTransitionRequest(val action:String="TRANSITION",val leadId:String,val version:Int,val toStage:LeadStage,val lostReason:String?=null)
@Serializable data class LeadFollowUpRequest(val action:String="FOLLOW_UP",val leadId:String,val followUpAt:String?=null,val notes:String?=null)
@Serializable data class Attendance(val id:String,val startedAt:String,val endedAt:String?=null)
@Serializable data class AttendanceRequest(val action:String,val location:LocationPayload?=null)
@Serializable data class LocationPayload(val latitude:Double,val longitude:Double,val accuracyMeters:Double?=null,val clientPointId:String?=null,val capturedAt:String?=null)

internal fun attendanceRequest(action:String,location:LocationPayload?):AttendanceRequest { if(location!=null&&location.capturedAt.isNullOrBlank())throw IllegalArgumentException("Attendance location measurement time is required"); if(location!=null)java.time.Instant.parse(location.capturedAt); return AttendanceRequest(action,location) }
internal fun employeeStatus(employee:Employee)=when{!employee.isActive->"Inactive identity";!employee.salesAccessActive->"Sales access suspended";else->"Active"}
internal fun employeeAction(employee:Employee)=when{!employee.isActive->"Reactivate identity";!employee.salesAccessActive->"Restore Sales access";else->"Deactivate employee"}
internal fun isActiveEmployee(employee:Employee)=employee.isActive&&employee.salesAccessActive
internal fun selectableManagers(employees:List<Employee>)=employees.filter{it.role==MobileRole.MANAGER&&isActiveEmployee(it)}
internal fun seatSummaryLines(entitlement:Entitlement,structure:TeamStructure)=buildList{add("Primary Admin — Included / Free");add("Additional Admin — ${entitlement.adminUsage} / ${entitlement.adminLimit}");if(structure==TeamStructure.MANAGERS_AND_SALES)add("Manager — ${entitlement.managerUsage} / ${entitlement.managerLimit}");add("Sales — ${entitlement.salesUsage} / ${entitlement.salesLimit}")}
internal fun subscriptionSeatLines(entitlement:CompanyEntitlement,structure:TeamStructure)=buildList{add("Primary Admin — Included / Free");add("Additional Admin — ${entitlement.adminUsage} / ${entitlement.adminLimit}");if(structure==TeamStructure.MANAGERS_AND_SALES)add("Manager — ${entitlement.managerUsage} / ${entitlement.managerLimit}");add("Sales — ${entitlement.salesUsage} / ${entitlement.salesLimit}")}
internal fun visiblePricingRoles(structure:TeamStructure)=if(structure==TeamStructure.MANAGERS_AND_SALES)setOf("ADMIN","MANAGER","SALES")else setOf("ADMIN","SALES")
