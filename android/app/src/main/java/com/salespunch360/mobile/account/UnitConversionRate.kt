package com.salespunch360.mobile.account

fun validUnitConversionRate(value:String):Boolean = Regex("[0-9]{1,14}(\\.[0-9]{1,4})?").matches(value) && value.any{it in '1'..'9'}
