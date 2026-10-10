package com.salespunch360.mobile
import org.junit.Assert.*
import org.junit.Test
import kotlinx.serialization.json.*
class ProjectMaterialRequestTest {
 private fun state()=ProjectMaterialState(loading=false,allowedActions=listOf("ISSUE","CONSUME","RETURN","TRANSFER","REVERSE"),projectId="a",productId="product",warehouseId="warehouse",budgetLineId="",quantity="2",movementDate="2026-10-09",requestKey="stable-request")
 @Test fun unchangedRetryKeepsSameRequestReference(){val s=state();assertEquals(projectMaterialPayload(s),projectMaterialPayload(s));assertEquals("stable-request",projectMaterialPayload(s)["idempotencyKey"]?.jsonPrimitive?.content)}
 @Test fun reversalDoesNotSendQuantityOrNotes(){val s=state().copy(action="REVERSE",movementId="movement",reason="Correction");val payload=projectMaterialPayload(s);assertEquals("movement",payload["movementId"]?.jsonPrimitive?.content);assertFalse(payload.containsKey("quantity"));assertFalse(payload.containsKey("notes"));assertNull(projectMaterialValidation(s))}
 @Test fun permissionAndQuantityBoundsAreChecked(){assertNotNull(projectMaterialValidation(state().copy(allowedActions=emptyList())));assertNotNull(projectMaterialValidation(state().copy(quantity="NaN")));assertNotNull(projectMaterialValidation(state().copy(quantity="0")));assertNotNull(projectMaterialValidation(state().copy(quantity="1.0000001")));assertNull(projectMaterialValidation(state()))}
 @Test fun consumesOnlyAvailableMaterialFromSelectedProject(){val source=buildJsonObject{put("id","source");put("projectId","a");put("availableQuantity","1")};val s=state().copy(action="CONSUME",sourceMovementId="source",sources=listOf(source));assertNotNull(projectMaterialValidation(s));assertNull(projectMaterialValidation(s.copy(quantity="1")));assertNotNull(projectMaterialValidation(s.copy(projectId="b",quantity="1")))}
 @Test fun transfersNeedDifferentProjectAndReason(){val source=buildJsonObject{put("id","source");put("projectId","a");put("availableQuantity","3")};val s=state().copy(action="TRANSFER",sourceMovementId="source",sources=listOf(source),destinationProjectId="a",reason="Move");assertNotNull(projectMaterialValidation(s));assertNull(projectMaterialValidation(s.copy(destinationProjectId="b")));assertNotNull(projectMaterialValidation(s.copy(destinationProjectId="b",reason="")))}
 @Test fun trackedIssuesIncludeIdentityAndRequireOnePhysicalSerial(){
  val product=buildJsonObject{put("id","product");put("trackingMode","SERIAL")}
  val s=state().copy(products=listOf(product))
  assertNotNull(projectMaterialValidation(s))
  assertNotNull(projectMaterialValidation(s.copy(serialNumberId="serial")))
  val valid=s.copy(serialNumberId="serial",quantity="1")
  assertNull(projectMaterialValidation(valid))
  assertEquals("serial",projectMaterialPayload(valid)["serialNumberId"]?.jsonPrimitive?.content)
 }
 @Test fun batchIssuesNeedBatchAndCarryItToServer(){
  val product=buildJsonObject{put("id","product");put("trackingMode","BATCH")}
  val s=state().copy(products=listOf(product))
  assertNotNull(projectMaterialValidation(s))
  assertNull(projectMaterialValidation(s.copy(batchId="batch")))
  assertEquals("batch",projectMaterialPayload(s.copy(batchId="batch"))["batchId"]?.jsonPrimitive?.content)
 }
 @Test fun inventoryIssueDoesNotRequireABudgetButValidatesAnyProvidedLink(){
  val s=state();assertNull(projectMaterialValidation(s));assertFalse(projectMaterialPayload(s).containsKey("projectBudgetLineId"))
  assertNotNull(projectMaterialValidation(s.copy(budgetLineId="foreign")))
  val budget=buildJsonObject{put("id","budget");put("projectId","a")}
  val linked=s.copy(budgetLineId="budget",budgetLines=listOf(budget));assertNull(projectMaterialValidation(linked));assertEquals("budget",projectMaterialPayload(linked)["projectBudgetLineId"]?.jsonPrimitive?.content)
 }

}
