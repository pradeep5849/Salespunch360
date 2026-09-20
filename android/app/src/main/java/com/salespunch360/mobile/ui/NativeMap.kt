package com.salespunch360.mobile.ui

import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import org.osmdroid.config.Configuration
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

data class NativeMapPoint(val latitude:Double,val longitude:Double,val label:String?=null)

@Composable fun NativeMap(segments:List<List<NativeMapPoint>>,markers:List<NativeMapPoint>,modifier:Modifier=Modifier.fillMaxWidth().height(260.dp)){
 val context=LocalContext.current
 Configuration.getInstance().userAgentValue=context.packageName
 val map=remember{MapView(context).apply{setMultiTouchControls(true);controller.setZoom(16.0)}}
 DisposableEffect(map){map.onResume();onDispose{map.onPause();map.onDetach()}}
 AndroidView(factory={map},modifier=modifier,update={view->
  view.overlays.clear()
  segments.filter{it.isNotEmpty()}.forEach{segment->view.overlays.add(Polyline().apply{setPoints(segment.map{GeoPoint(it.latitude,it.longitude)});outlinePaint.color=android.graphics.Color.rgb(25,96,180);outlinePaint.strokeWidth=7f})}
  markers.forEachIndexed{index,point->view.overlays.add(Marker(view).apply{position=GeoPoint(point.latitude,point.longitude);title=point.label?:"Location ${index+1}";setAnchor(Marker.ANCHOR_CENTER,Marker.ANCHOR_BOTTOM)})}
  val all=(segments.flatten()+markers);if(all.isNotEmpty()){if(all.size==1){view.controller.setCenter(GeoPoint(all[0].latitude,all[0].longitude));view.controller.setZoom(17.0)}else{val north=all.maxOf{it.latitude};val south=all.minOf{it.latitude};val east=all.maxOf{it.longitude};val west=all.minOf{it.longitude};view.zoomToBoundingBox(BoundingBox(north,east,south,west),true,64)}};view.invalidate()
 })
}
