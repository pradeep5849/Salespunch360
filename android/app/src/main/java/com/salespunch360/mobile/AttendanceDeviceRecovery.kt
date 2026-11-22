package com.salespunch360.mobile

import kotlinx.coroutines.CancellationException

/** Device effects cannot undo an attendance response already committed by the server. */
internal fun attendanceDeviceRecovery(tracking:()->Unit,sync:()->Unit):String? {
 val warnings=mutableListOf<String>()
 for((effect,message)in listOf(tracking to "GPS tracking needs attention. Check location permissions and reopen the app to retry.",sync to "GPS upload scheduling needs attention. Reopen the app or use Retry sync when connected.")){
  try{effect()}catch(cancel:CancellationException){throw cancel}catch(_:Exception){warnings.add(message)}
 }
 return warnings.takeIf{it.isNotEmpty()}?.joinToString(" ")
}
