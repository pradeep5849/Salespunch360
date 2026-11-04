package com.salespunch360.mobile.data

import java.io.IOException
import java.security.MessageDigest

fun verifyBackupIntegrity(bytes: ByteArray, expected: String?) {
    if(bytes.isEmpty() || expected == null || !Regex("^[a-fA-F0-9]{64}$").matches(expected)) throw IOException("The backup is empty or its checksum is missing.")
    val digest = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 0xff) }
    if(!MessageDigest.isEqual(digest.toByteArray(), expected.lowercase().toByteArray())) throw IOException("Backup integrity verification failed. Please generate it again.")
}
