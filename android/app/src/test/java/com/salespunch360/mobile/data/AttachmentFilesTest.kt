package com.salespunch360.mobile.data

import org.junit.Assert.*
import org.junit.Test
import java.nio.file.Files

class AttachmentFilesTest {
 @Test fun hostileNamesCannotEscapeCache(){
  val cache=Files.createTempDirectory("expense-test").toFile()
  try { listOf("../../session.xml","/absolute/path.pdf","..\\secret.pdf","name.pdf","a\n.pdf").forEach{ name->
   val target=safeAttachmentFile(cache,name)
   assertEquals(cache.resolve("expense-attachments").canonicalFile,target.canonicalFile.parentFile)
   assertFalse(target.name.contains("/"));assertFalse(target.name.contains("\\"))
  }} finally {cache.deleteRecursively()}
 }
 @Test fun repeatedDownloadsUseDistinctFiles(){
  val cache=Files.createTempDirectory("expense-test").toFile()
  try {assertNotEquals(safeAttachmentFile(cache,"invoice.pdf"),safeAttachmentFile(cache,"invoice.pdf"))} finally {cache.deleteRecursively()}
 }
}
