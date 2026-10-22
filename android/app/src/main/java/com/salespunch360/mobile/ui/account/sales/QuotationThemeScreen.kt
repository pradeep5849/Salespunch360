package com.salespunch360.mobile.ui.account.sales

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.salespunch360.mobile.QuotationState
import com.salespunch360.mobile.QuotationViewModel
import com.salespunch360.mobile.account.array
import com.salespunch360.mobile.account.str
import kotlinx.serialization.json.*

/** Temporary authorized PDF preview; only Apply persists the company's selection. */
@Composable
fun QuotationThemeScreen(state:QuotationState,vm:QuotationViewModel){
 val data=state.themePicker?:return
 val themes=data.array("themes")
 val selected=themes.indexOfFirst{it.str("id")==state.selectedTheme}.coerceAtLeast(0)
 fun move(offset:Int){if(themes.isNotEmpty())vm.chooseTheme(themes[(selected+offset+themes.size)%themes.size].str("id"))}
 Dialog(onDismissRequest={if(!state.saving)vm.cancelTheme()},properties=DialogProperties(usePlatformDefaultWidth=false)){
  Surface(Modifier.fillMaxSize()){
   Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)){
    Row(Modifier.fillMaxWidth().background(Color(0xFFE4F3FF)).padding(12.dp),verticalAlignment=Alignment.CenterVertically){
     TextButton(onClick=vm::cancelTheme,enabled=!state.saving){Text("Back")}
     Text("Transaction Theme",style=MaterialTheme.typography.titleLarge)
    }
    Text(themes.getOrNull(selected)?.str("name").orEmpty(),style=MaterialTheme.typography.headlineSmall,modifier=Modifier.padding(16.dp))
    if(state.selectedTheme!="TALLY")LazyRow(contentPadding=PaddingValues(horizontal=12.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){
     items(data["colors"]?.jsonArray?.map{it.jsonPrimitive.content}.orEmpty()){color->
      FilterChip(selected=state.selectedThemeColor.equals(color,true),enabled=!state.saving,onClick={vm.chooseThemeColor(color)},label={Box(Modifier.size(28.dp).background(Color(android.graphics.Color.parseColor(color)),CircleShape))},modifier=Modifier.heightIn(min=48.dp).semantics{contentDescription="Theme colour $color"})
     }
    }
    Row(Modifier.fillMaxWidth().padding(horizontal=8.dp),horizontalArrangement=Arrangement.SpaceBetween){
     TextButton(onClick={move(-1)},enabled=!state.saving){Text("Previous theme")}
     Text("${selected+1} / ${themes.size}",modifier=Modifier.align(Alignment.CenterVertically))
     TextButton(onClick={move(1)},enabled=!state.saving){Text("Next theme")}
    }
    Box(Modifier.weight(1f).fillMaxWidth().padding(12.dp),contentAlignment=Alignment.Center){
     val bytes=state.themePreviewPdf
     when{state.themeLoading->CircularProgressIndicator();bytes!=null->QuotationPdfThumbnail(bytes,Modifier.fillMaxSize());else->OutlinedButton(onClick=vm::refreshThemePreview){Text("Retry preview")}}
    }
    state.error?.let{Text(it,color=MaterialTheme.colorScheme.error,modifier=Modifier.padding(horizontal=12.dp))}
    TextButton(onClick=vm::previewTheme,enabled=state.themePreviewPdf!=null&&!state.saving,modifier=Modifier.align(Alignment.CenterHorizontally)){Text("Open PDF · Print · Share")}
    Row(Modifier.fillMaxWidth().padding(12.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)){
     OutlinedButton(onClick=vm::cancelTheme,enabled=!state.saving,modifier=Modifier.weight(1f)){Text("Cancel")}
     if(data["canSave"]?.jsonPrimitive?.booleanOrNull==true)Button(onClick={vm.applyTheme()},enabled=!state.saving&&state.themePreviewPdf!=null,modifier=Modifier.weight(1f)){Text(if(state.saving)"Saving…" else "Apply Changes")}
    }
   }
  }
 }
}
