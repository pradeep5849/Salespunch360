package com.salespunch360.mobile.data
import kotlinx.serialization.Serializable
@Serializable data class NumberingRestartOption(val id:String,val type:String,val branch:String,val prefix:String,val suffix:String,val padding:Int,val nextSequence:String)
@Serializable data class NumberingRestartReview(val token:String,val type:String,val branch:String,val previousPrefix:String,val previousNextSequence:String,val prefix:String,val examples:List<String>,val expiresAt:String)
