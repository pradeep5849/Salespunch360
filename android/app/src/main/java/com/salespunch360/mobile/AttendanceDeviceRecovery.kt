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

/** A bootstrap after a lost response proves current state, not who committed a transition. */
internal fun attendanceTransportRecovery(start:Boolean,previousId:String?,current:com.salespunch360.mobile.data.Attendance?):String = when {
 start && current!=null -> "Attendance is active. Started ${com.salespunch360.mobile.data.attendanceSnapshotTimeIst(current.startedAt)}. Current state recovered after a connection failure."
 !start && current==null -> "Attendance is stopped. Current state recovered after a connection failure. View attendance history for the recorded stop time."
 !start && current?.id!=previousId -> "Attendance is active in a different session. Current state was refreshed; review attendance before stopping this session."
 else -> "The request could not be confirmed. Attendance is currently ${if(current==null)"stopped"else"active"}. Review attendance history before retrying."
}
