package com.salespunch360.mobile.data

import java.io.File
import java.util.UUID

/** The remote display name never becomes a filesystem path. */
internal fun safeAttachmentFile(cache:File,displayName:String):File {
    val directory=File(cache,"expense-attachments")
    check(directory.mkdirs()||directory.isDirectory){"Attachment directory is unavailable"}
    val extension=displayName.substringAfterLast('.',"").lowercase().takeIf{it in setOf("pdf","png","jpg","jpeg","webp")}
    val target=File(directory,UUID.randomUUID().toString()+(extension?.let{".$it"}?:".bin"))
    check(target.canonicalFile.parentFile==directory.canonicalFile)
    return target
}
