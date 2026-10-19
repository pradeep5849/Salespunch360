package com.salespunch360.mobile
import com.salespunch360.mobile.account.SalesLineDraft
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
class QuotationPreviewTest {
 private fun line(quantity:String="1",rate:String="100",tax:String="18",discountType:String="",discount:String="0")=SalesLineDraft(lineType="CUSTOM",quantity=quantity,rate=rate,taxRate=tax,discountType=discountType,discountValue=discount)
 private fun adjustment(type:String="DISCOUNT",mode:String="FIXED",value:String="10",taxable:Boolean=false,tax:String="0")=buildJsonObject{put("type",type);put("valueType",mode);put("value",value);put("taxable",taxable);put("taxRate",tax)}
 @Test fun quantityTaxAndLineDiscountMatchServerFixtures(){
  val draft=QuotationDraft(lines=listOf(line("5","70")))
  assertEquals("413.00",quotationPreview(draft)?.total)
  assertEquals("371.70",quotationPreview(draft.copy(lines=listOf(line("5","70",discountType="PERCENTAGE",discount="10"))))?.total)
 }
 @Test fun documentDiscountAllocatesBeforeMixedTax(){
  val result=quotationPreview(QuotationDraft(lines=listOf(line(tax="5"),line()),adjustments=listOf(adjustment(value="20"))))!!
  assertEquals("180.00",result.taxable);assertEquals("20.70",result.tax);assertEquals("200.70",result.total)
 }
 @Test fun roundingRemainderAndTaxableChargesMatchServer(){
  val result=quotationPreview(QuotationDraft(lines=List(3){line(rate="1")},adjustments=listOf(adjustment(value="0.01"))))!!
  assertEquals("0.01",result.discount);assertEquals("0.54",result.tax);assertEquals("3.53",result.total)
  assertEquals("159.00",quotationPreview(QuotationDraft(lines=listOf(line(tax="0")),adjustments=listOf(adjustment("ADDITIONAL_CHARGE",value="50",taxable=true,tax="18"))))?.total)
 }
 @Test fun invalidInputsClearPreviewAndDoNotModifyDraft(){
  for(invalid in listOf(line(quantity="0"),line(rate=""),line(tax="101"),line(discountType="FIXED",discount="101")))assertNull(quotationPreview(QuotationDraft(lines=listOf(invalid))))
  val draft=QuotationDraft(lines=listOf(line()),adjustments=listOf(adjustment(value="101")));assertNull(quotationPreview(draft));assertEquals("100",draft.lines.first().rate)
 }
 @Test fun blankMasterRateOrTaxIsNeverGuessed(){
  assertNull(quotationPreview(QuotationDraft(lines=listOf(line().copy(lineType="PRODUCT",taxRate="")))))
  assertEquals("100.00",quotationPreview(QuotationDraft(lines=listOf(line(tax=""))))?.total)
 }
 @Test fun percentageAndSuccessiveChargesMatchServer(){
  val result=quotationPreview(QuotationDraft(lines=listOf(line(rate="200")),adjustments=listOf(adjustment(mode="PERCENTAGE",value="10"),adjustment("ADDITIONAL_CHARGE",value="20",taxable=true,tax="18"))))!!
  assertEquals("236.00",result.total)
 }
 @Test fun roundingMatchesServerWithoutChangingDraftPrices(){
  for((rate,total,offset)in listOf(Triple("100.49","100.00","-0.49"),Triple("100.50","101.00","0.50"),Triple("100.51","101.00","0.49"),Triple("0.49","0.00","-0.49"))){
   val draft=QuotationDraft(roundOffEnabled=true,lines=listOf(line(rate=rate,tax="0")))
   val rounded=quotationPreview(draft)!!;assertEquals(total,rounded.total);assertEquals(offset,rounded.roundOff);assertEquals(rate,draft.lines.first().rate)
   assertEquals(rate,quotationPreview(draft.copy(roundOffEnabled=false))!!.total)
  }
 }
}
