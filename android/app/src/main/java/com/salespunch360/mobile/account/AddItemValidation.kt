package com.salespunch360.mobile.account

import java.math.BigDecimal
import java.time.LocalDate
import kotlinx.serialization.json.JsonObject

/** Matches the master/opening/pricing API bounds before any network write. */
fun addItemValidationError(name:String,code:String,description:String,sale:String,cost:String,tax:String,hsn:String,minimum:String,openingQuantity:String,openingCost:String,openingDate:String,location:String,pricing:JsonObject?):String? {
    if(name.trim().isEmpty()||name.trim().length>200)return "Item name must contain 1–200 characters."
    if(code.trim().length>60)return "Item code must contain at most 60 characters."
    if(description.trim().length>2000)return "Description must contain at most 2000 characters."
    if(hsn.trim().length>12)return "HSN/SAC code must contain at most 12 characters."
    if(location.trim().length>240)return "Item location must contain at most 240 characters."
    fun nonnegative(value:String,max:String):Boolean {val number=value.ifBlank{"0"}.toBigDecimalOrNull()?:return false;return number>=BigDecimal.ZERO&&number<=BigDecimal(max)}
    if(!nonnegative(sale,"9999999999999999"))return "Enter a valid non-negative sale price."
    if(!nonnegative(cost,"9999999999999999"))return "Enter a valid non-negative purchase price."
    if(!nonnegative(tax,"100"))return "Tax rate must be between 0 and 100."
    if(!nonnegative(minimum,"99999999999999"))return "Enter a valid non-negative minimum stock."
    val decimal=Regex("\\d{1,14}(\\.\\d{1,4})?")
    if(openingQuantity.isNotBlank()){
        if(!decimal.matches(openingQuantity)||!decimal.matches(openingCost.ifBlank{"0"}))return "Opening quantity and unit cost allow up to 14 digits and 4 decimal places."
        if(runCatching{LocalDate.parse(openingDate).toString()==openingDate}.getOrDefault(false).not())return "Enter a valid opening date (YYYY-MM-DD)."
    }
    if(pricing!=null){
        val discount=pricing.str("discountValue").ifBlank{"0"}
        if(!decimal.matches(discount))return "Sale discount allows up to 14 digits and 4 decimal places."
        if(pricing.str("discountType")=="PERCENTAGE"&&BigDecimal(discount)>BigDecimal(100))return "Sale discount percentage cannot exceed 100."
        if(pricing.str("discountType")=="FIXED"&&BigDecimal(discount)>BigDecimal(sale.ifBlank{"0"}))return "Sale discount cannot exceed the sale price."
        val mrp=pricing.str("mrp")
        if(mrp.isNotEmpty()&&!decimal.matches(mrp))return "MRP allows up to 14 digits and 4 decimal places."
        val wholesale=pricing.str("wholesalePrice")
        if(wholesale.isNotEmpty()&&!decimal.matches(wholesale))return "Wholesale price allows up to 14 digits and 4 decimal places."
    }
    return null
}
