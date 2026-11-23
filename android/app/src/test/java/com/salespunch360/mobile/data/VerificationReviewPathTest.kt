package com.salespunch360.mobile.data
import org.junit.Assert.*
import org.junit.Test
class VerificationReviewPathTest {
 @Test fun retainsOnlyKnownReadRoutes() {
  val id="00000000-0000-4000-8000-000000000003"
  for(root in listOf("/workspace/account/accounting/journals","/workspace/account/transactions","/workspace/account/projects","/workspace/account/assets")){assertEquals(root,verificationReviewPath(root));assertEquals("$root/$id",verificationReviewPath("$root/$id"))}
  assertEquals("/workspace/account/inventory/transfers",verificationReviewPath("/workspace/account/inventory/transfers"))
 }
 @Test fun rejectsExternalAndMutationOrEncodedPaths() {
  for(path in listOf("https://evil.invalid/workspace/account/projects","//evil.invalid/workspace/account/projects","/workspace/account/projects/new","/workspace/account/projects/../settings","/workspace/account/projects/%2e%2e","/workspace/account/projects?delete=1","/workspace/account/projects#fragment"))assertNull(verificationReviewPath(path))
 }
}
