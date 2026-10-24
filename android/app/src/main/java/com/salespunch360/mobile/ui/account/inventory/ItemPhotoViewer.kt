package com.salespunch360.mobile.ui.account.inventory
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun ItemPhotoViewer(kind:String,id:String,name:String){
 val context=LocalContext.current
 val api=remember(context){ApiClient(SecureSession(context))}
 var open by remember(id){mutableStateOf(false)}
 var attempt by remember(id){mutableIntStateOf(0)}
 var image by remember(id){mutableStateOf<ImageBitmap?>(null)}
 var error by remember(id){mutableStateOf(false)}
 IconButton(onClick={open=true}){Icon(Icons.Default.Image,"View photo for $name")}
 if(open){
  LaunchedEffect(kind,id,attempt){error=false;image=null;runCatching{withContext(Dispatchers.IO){val bytes=api.itemPhoto(kind,id);BitmapFactory.decodeByteArray(bytes,0,bytes.size)?.asImageBitmap()?:throw IllegalArgumentException("Invalid photo")}}.onSuccess{image=it}.onFailure{error=true}}
  AlertDialog(onDismissRequest={open=false},title={Text("$name photo")},text={val bitmap=image;if(bitmap!=null)Image(bitmap,"$name photo",Modifier.size(240.dp))else if(error)Text("Photo could not be loaded. Check your connection and retry.")else CircularProgressIndicator()},confirmButton={TextButton(onClick={open=false}){Text("Close")}},dismissButton={if(error)TextButton(onClick={attempt++}){Text("Retry")}})
 }
}
