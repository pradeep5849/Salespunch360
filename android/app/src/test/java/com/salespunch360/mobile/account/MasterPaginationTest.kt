package com.salespunch360.mobile.account

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class MasterPaginationTest {
    @Test fun includesRecordsBeyondTwoHundred() = runBlocking {
        val calls = mutableListOf<Int>()
        val rows = loadMasterPages { offset -> calls.add(offset); (offset until minOf(offset+200,401)).toList() }
        assertEquals((0 until 401).toList(), rows)
        assertEquals(listOf(0,200,400),calls)
    }
    @Test fun exactPageBoundaryChecksTheNextEmptyPage() = runBlocking {
        val calls = mutableListOf<Int>()
        val rows = loadMasterPages { offset -> calls.add(offset); if(offset==0)(0 until 200).toList()else emptyList() }
        assertEquals(200,rows.size)
        assertEquals(listOf(0,200),calls)
    }
    @Test fun subsequentPageFailureCannotPretendTheFirstPageIsComplete() = runBlocking {
        try {
            loadMasterPages { offset -> if(offset==0)(0 until 200).toList()else throw IllegalStateException("offline") }
            fail("Incomplete pagination must fail")
        } catch(error: IllegalStateException) { assertEquals("offline",error.message) }
    }
}
