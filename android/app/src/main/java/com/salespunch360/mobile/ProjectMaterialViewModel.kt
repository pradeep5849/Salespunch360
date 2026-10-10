package com.salespunch360.mobile
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.account.*
import com.salespunch360.mobile.data.*
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
data class ProjectMaterialState(
 val loading:Boolean=true,val saving:Boolean=false,
 val projects:List<JsonObject> = emptyList(),val warehouses:List<JsonObject> = emptyList(),val products:List<JsonObject> = emptyList(),val batches:List<JsonObject> = emptyList(),val serialNumbers:List<JsonObject> = emptyList(),val budgetLines:List<JsonObject> = emptyList(),val movements:List<JsonObject> = emptyList(),val sources:List<JsonObject> = emptyList(),
 val allowedActions:List<String> = emptyList(),val sourcePage:Int=1,val sourcePages:Int=1,val historyPage:Int=1,val historyPages:Int=1,
 val action:String="ISSUE",val projectId:String="",val destinationProjectId:String="",val warehouseId:String="",val productId:String="",val batchId:String="",val serialNumberId:String="",val budgetLineId:String="",val sourceMovementId:String="",val movementId:String="",val quantity:String="",val reason:String="",val notes:String="",val movementDate:String=java.time.LocalDate.now().toString(),val requestKey:String=UUID.randomUUID().toString(),val error:String?=null,val message:String?=null
)
internal fun projectMaterialPayload(s:ProjectMaterialState)=buildJsonObject{
 put("movementDate",s.movementDate);put("idempotencyKey",s.requestKey)
 if(s.action=="REVERSE"){put("movementId",s.movementId);put("reason",s.reason)}
 else{put("quantity",s.quantity);put("notes",s.notes);when(s.action){
  "ISSUE"->{put("projectId",s.projectId);put("warehouseId",s.warehouseId);put("productId",s.productId);if(s.budgetLineId.isNotBlank())put("projectBudgetLineId",s.budgetLineId);if(s.batchId.isNotBlank())put("batchId",s.batchId);if(s.serialNumberId.isNotBlank())put("serialNumberId",s.serialNumberId)}
  "CONSUME"->{put("projectId",s.projectId);put("sourceMovementId",s.sourceMovementId)}
  "RETURN"->{put("projectId",s.projectId);put("sourceMovementId",s.sourceMovementId);put("warehouseId",s.warehouseId);put("reason",s.reason)}
  "TRANSFER"->{put("sourceProjectId",s.projectId);put("destinationProjectId",s.destinationProjectId);put("sourceMovementId",s.sourceMovementId);put("reason",s.reason)}
 }}
}
internal fun projectMaterialValidation(s:ProjectMaterialState):String?{
 if(s.action !in s.allowedActions)return "Your permissions do not allow this action."
 if(runCatching{java.time.LocalDate.parse(s.movementDate)}.isFailure)return "Enter an effective date in YYYY-MM-DD format."
 if(s.action=="REVERSE")return if(s.movementId.isBlank()||s.reason.isBlank())"Choose a movement and enter a reversal reason." else null
 val quantity=runCatching{java.math.BigDecimal(s.quantity)}.getOrNull()
 if(!Regex("\\d{1,14}(\\.\\d{1,6})?").matches(s.quantity)||quantity==null||quantity.signum()<=0)return "Enter a positive quantity with up to six decimal places."
 if(s.projectId.isBlank())return "Select a Project."
 if(s.action=="ISSUE"&&(s.productId.isBlank()||s.warehouseId.isBlank()))return "Select a product and warehouse."
 if(s.action=="ISSUE"){
  if(s.budgetLineId.isNotBlank() && s.budgetLines.none{it.str("id")==s.budgetLineId && it.str("projectId")==s.projectId})return "Select a budget line belonging to this Project, or leave it blank."
  val mode=s.products.find{it.str("id")==s.productId}?.str("trackingMode")
  if(mode=="BATCH"&&s.batchId.isBlank())return "Select a batch."
  if(mode=="SERIAL"&&(s.serialNumberId.isBlank()||quantity.compareTo(java.math.BigDecimal.ONE)!=0))return "Select a serial number and issue exactly one unit."
 }
 if(s.action!="ISSUE"){
  val source=s.sources.find{it.str("id")==s.sourceMovementId&&it.str("projectId")==s.projectId}
  val available=source?.str("availableQuantity")?.toBigDecimalOrNull()
  if(available==null||quantity>available)return "Quantity exceeds the selected receipt's available material."
 }
 if(s.action=="RETURN"&&s.warehouseId.isBlank())return "Select a destination warehouse."
 if(s.action=="TRANSFER"&&(s.destinationProjectId.isBlank()||s.destinationProjectId==s.projectId))return "Select a different destination Project."
 if(s.action in listOf("RETURN","TRANSFER")&&s.reason.isBlank())return "Enter a reason."
 return null
}
class ProjectMaterialViewModel(app:Application):AndroidViewModel(app){
 private val api=ApiClient(SecureSession(app));private val _state=MutableStateFlow(ProjectMaterialState());val state:StateFlow<ProjectMaterialState> = _state
 private var generation=0
 private var initialRouteApplied=false
 fun initialRoute(projectId:String?){if(initialRouteApplied)return;initialRouteApplied=true;if(!projectId.isNullOrBlank()){_state.value=_state.value.copy(projectId=projectId);refresh(1,1)}}
 fun selectProduct(productId:String){update{it.copy(productId=productId,batchId="",serialNumberId="")};refresh()}
 fun selectProject(projectId:String){update{it.copy(projectId=projectId,sourceMovementId="",budgetLineId="",warehouseId="",destinationProjectId="")};refresh(1,1)}
 init{refresh()}
 fun update(f:(ProjectMaterialState)->ProjectMaterialState){if(_state.value.saving)return;_state.value=f(_state.value).copy(requestKey=UUID.randomUUID().toString(),error=null,message=null)}
 fun refresh(sourcePage:Int=_state.value.sourcePage,historyPage:Int=_state.value.historyPage)=viewModelScope.launch{
  val request=++generation;_state.value=_state.value.copy(loading=true,error=null)
  runCatching{api.projectMaterialContext(sourcePage,historyPage,_state.value.projectId,_state.value.productId)}.onSuccess{c->if(request!=generation)return@onSuccess
   val caps=c["capabilities"] as? JsonObject
   val allowed=listOf("ISSUE","CONSUME","RETURN","TRANSFER","REVERSE").filter{caps?.get(it)?.jsonPrimitive?.booleanOrNull==true}
   _state.value=_state.value.copy(loading=false,projects=c.array("projects"),warehouses=c.array("warehouses"),products=c.array("products"),batches=c.array("batches"),serialNumbers=c.array("serialNumbers"),budgetLines=c.array("budgetLines"),movements=c.array("movements"),sources=c.array("sources"),allowedActions=allowed,action=_state.value.action.takeIf{it in allowed}?:allowed.firstOrNull().orEmpty(),sourcePage=c["sourcePage"]?.jsonPrimitive?.intOrNull?:1,sourcePages=c["sourcePages"]?.jsonPrimitive?.intOrNull?:1,historyPage=c["historyPage"]?.jsonPrimitive?.intOrNull?:1,historyPages=c["historyPages"]?.jsonPrimitive?.intOrNull?:1)
  }.onFailure{if(request==generation)_state.value=_state.value.copy(loading=false,error=errorMessage(it))}
 }
 private fun errorMessage(e:Throwable)=when(e){is ApiException->e.serverMessage?:when(e.status){401->"Session expired. Sign in again.";403->"Your permission or module settings changed. Reload to continue.";else->"The server rejected this movement. Check its current available quantity and status."};else->"Connection interrupted. Your inputs and request reference were kept; retry when online."}
 fun post(){val s=_state.value;if(s.saving||s.loading)return;val error=projectMaterialValidation(s);if(error!=null){_state.value=s.copy(error=error);return};_state.value=s.copy(saving=true,error=null,message=null)
  viewModelScope.launch{runCatching{api.postProjectMaterial(s.action,projectMaterialPayload(s))}.onSuccess{_state.value=_state.value.copy(saving=false,quantity="",sourceMovementId="",movementId="",requestKey=UUID.randomUUID().toString(),message="Material movement posted.");refresh()}.onFailure{_state.value=_state.value.copy(saving=false,error=errorMessage(it))}}
 }
}
