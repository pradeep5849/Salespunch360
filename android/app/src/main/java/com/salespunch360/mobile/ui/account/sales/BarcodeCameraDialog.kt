package com.salespunch360.mobile.ui.account.sales

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.salespunch360.mobile.account.compactBarcodeLuma
import com.salespunch360.mobile.account.decodeBarcodeLuma
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@Composable
fun BarcodeCameraDialog(onDetected:(String)->Unit,onClose:()->Unit){
 val context=LocalContext.current
 val lifecycle=LocalLifecycleOwner.current
 val detected by rememberUpdatedState(onDetected)
 var allowed by remember{mutableStateOf(ContextCompat.checkSelfPermission(context,Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)}
 var message by remember{mutableStateOf<String?>(null)}
 val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()){granted->allowed=granted;if(!granted)message="Camera access was denied. Allow it in app settings or enter the barcode manually."}
 val view=remember{PreviewView(context)}
 LaunchedEffect(Unit){if(!allowed)permission.launch(Manifest.permission.CAMERA)}
 if(allowed)DisposableEffect(lifecycle,view){
  val stopped=AtomicBoolean(false)
  val found=AtomicBoolean(false)
  val executor=Executors.newSingleThreadExecutor()
  val main=ContextCompat.getMainExecutor(context)
  val future=ProcessCameraProvider.getInstance(context)
  var provider:ProcessCameraProvider?=null
  val preview=Preview.Builder().build().also{it.setSurfaceProvider(view.surfaceProvider)}
  val analysis=ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
  analysis.setAnalyzer(executor){image->
   try{
    if(!stopped.get()&&!found.get()){
     val plane=image.planes[0];val buffer=plane.buffer.duplicate();val bytes=ByteArray(buffer.remaining());buffer.get(bytes)
     val value=decodeBarcodeLuma(compactBarcodeLuma(bytes,image.width,image.height,plane.rowStride,plane.pixelStride),image.width,image.height)
     if(value!=null&&found.compareAndSet(false,true))main.execute{if(!stopped.get())detected(value)}
    }
   }catch(_:Exception){/* A blurred or incomplete frame is retried with the next frame. */}finally{image.close()}
  }
  future.addListener({if(!stopped.get())try{provider=future.get();provider!!.bindToLifecycle(lifecycle,CameraSelector.DEFAULT_BACK_CAMERA,preview,analysis)}catch(_:Exception){message="The camera could not start. Enter the barcode manually."}},main)
  onDispose{stopped.set(true);analysis.clearAnalyzer();provider?.unbind(preview,analysis);executor.shutdown()}
 }
 Dialog(onDismissRequest=onClose){Surface(shape=MaterialTheme.shapes.large){Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  Row{Text("Scan item barcode",style=MaterialTheme.typography.titleLarge,modifier=Modifier.weight(1f));TextButton(onClose){Text("Close")}}
  if(message!=null)Text(message!!,color=MaterialTheme.colorScheme.error)else if(allowed){AndroidView(factory={view},modifier=Modifier.fillMaxWidth().height(320.dp));Text("Point the camera at the item barcode.")}else Text("Waiting for camera access…")
  TextButton(onClose){Text("Use manual entry")}
 }}}
}
