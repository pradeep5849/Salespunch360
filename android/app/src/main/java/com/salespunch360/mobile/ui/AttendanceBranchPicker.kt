package com.salespunch360.mobile.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.*
import androidx.compose.runtime.*
import com.salespunch360.mobile.data.Bootstrap

@Composable internal fun AttendanceBranchPicker(data:Bootstrap,selected:String?,onSelect:(String)->Unit,enabled:Boolean){
 if(data.branches.isEmpty()){Text("Refresh to load attendance access.");return}
 if(data.branches.size<=1)return
 fun label(id:String?)=data.branches.indexOfFirst{it.id==id}.takeIf{it>=0}?.let{index->data.branches[index].name?:"Branch ${index+1}"}
 if(data.attendance!=null){Text("Branch: ${label(data.attendance.branchId)?:"Refresh current attendance context"}");return}
 var expanded by remember{mutableStateOf(false)}
 Column{
  OutlinedButton({expanded=true},enabled=enabled){Text(label(selected)?:"Choose attendance branch")}
  DropdownMenu(expanded,{expanded=false}){data.branches.forEachIndexed{index,branch->DropdownMenuItem(text={Text(branch.name?:"Branch ${index+1}")},onClick={onSelect(branch.id);expanded=false},enabled=enabled)}}
 }
}
