package com.salespunch360.mobile.data
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
fun attendanceTimeIst(value:String):String=runCatching{OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.of("Asia/Kolkata")).format(DateTimeFormatter.ofPattern("h:mm a",Locale.ENGLISH))+" IST"}.getOrDefault(value)

fun attendanceSnapshotTimeIst(value:String):String=runCatching{OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.of("Asia/Kolkata")).format(DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a",Locale.ENGLISH))+" IST"}.getOrDefault(value)
