package com.salespunch360.mobile.data

import kotlinx.serialization.Serializable

@Serializable data class AttendanceBranch(val id:String,val name:String?=null)
internal fun attendanceBranchId(branches:List<AttendanceBranch>,selected:String?,active:Attendance?):String? {
 if(active!=null)return active.branchId?:branches.singleOrNull()?.id
 return branches.singleOrNull()?.id?:selected?.takeIf{id->branches.any{it.id==id}}
}
