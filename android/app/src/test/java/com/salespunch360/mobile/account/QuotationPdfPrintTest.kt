package com.salespunch360.mobile.account

import java.io.ByteArrayOutputStream
import java.io.InterruptedIOException
import org.junit.Assert.*
import org.junit.Test

class QuotationPdfPrintTest {
 private val pdf="%PDF-1.7\n".toByteArray()+ByteArray(50000){(it%251).toByte()}
 @Test fun printsOriginalBytesWithoutChangingFinancialDocument(){val original=pdf.copyOf();val output=ByteArrayOutputStream();copyQuotationPdfForPrint(pdf,output){false};assertArrayEquals(original,output.toByteArray());assertArrayEquals(original,pdf)}
 @Test fun cancellationBeforeWritingProducesNoOutput(){val output=ByteArrayOutputStream();assertThrows(InterruptedIOException::class.java){copyQuotationPdfForPrint(pdf,output){true}};assertEquals(0,output.size())}
 @Test fun cancellationBetweenChunksStopsTheCopy(){val output=ByteArrayOutputStream();var checks=0;assertThrows(InterruptedIOException::class.java){copyQuotationPdfForPrint(pdf,output){++checks>=3}};assertTrue(output.size()>0);assertTrue(output.size()<pdf.size)}
 @Test fun invalidResponseIsNeverWrittenAsPdf(){for(bytes in listOf(byteArrayOf(),"{\"error\":\"UNAUTHORIZED\"}".toByteArray(),"%PD".toByteArray())){val output=ByteArrayOutputStream();assertThrows(IllegalArgumentException::class.java){copyQuotationPdfForPrint(bytes,output){false}};assertEquals(0,output.size())}}
 @Test fun jobNameIsBoundedAndContainsNoPathOrControlCharacters(){assertEquals("Quotation.pdf",quotationPrintName("  "));assertEquals("EST-22.PDF",quotationPrintName("EST-22.PDF"));assertEquals("client_file_name.pdf",quotationPrintName("client/file\nname"));assertTrue(quotationPrintName("x".repeat(200)).length<=124)}
}
