package com.salespunch360.mobile.data

import java.io.IOException
import org.junit.Assert.assertThrows
import org.junit.Test

class BackupIntegrityTest {
    private val checksum = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    @Test fun acceptsExactBytesWithVerifiedChecksum() { verifyBackupIntegrity("abc".toByteArray(), checksum) }
    @Test fun rejectsCorruptOrUnverifiableDownloads() {
        assertThrows(IOException::class.java) { verifyBackupIntegrity("changed".toByteArray(), checksum) }
        assertThrows(IOException::class.java) { verifyBackupIntegrity("abc".toByteArray(), null) }
        assertThrows(IOException::class.java) { verifyBackupIntegrity(byteArrayOf(), checksum) }
    }
}
