package com.salespunch360.mobile.ui

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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

data class NativeMapPoint(
    val latitude: Double,
    val longitude: Double,
    val label: String? = null,
    val snippet: String? = null,
    val showInfo: Boolean = false,
)

private const val MAX_RENDERED_ROUTE_POINTS = 900

private fun sampledSegments(segments: List<List<NativeMapPoint>>): List<List<NativeMapPoint>> {
    val nonEmpty = segments.filter { it.isNotEmpty() }
    val total = nonEmpty.sumOf { it.size }
    if (total <= MAX_RENDERED_ROUTE_POINTS) return nonEmpty

    val budgetPerSegment = (MAX_RENDERED_ROUTE_POINTS / nonEmpty.size).coerceAtLeast(2)
    return nonEmpty.map { segment ->
        if (segment.size <= budgetPerSegment) return@map segment
        if (budgetPerSegment == 2) return@map listOf(segment.first(), segment.last())

        val sampled = ArrayList<NativeMapPoint>(budgetPerSegment)
        sampled += segment.first()
        val interiorBudget = budgetPerSegment - 2
        val step = (segment.size - 2).toDouble() / interiorBudget
        repeat(interiorBudget) { index ->
            val sourceIndex = (1 + index * step).toInt().coerceIn(1, segment.lastIndex - 1)
            sampled += segment[sourceIndex]
        }
        sampled += segment.last()
        sampled
    }
}

@Composable
fun NativeMap(
    segments: List<List<NativeMapPoint>>,
    markers: List<NativeMapPoint>,
    modifier: Modifier = Modifier.fillMaxWidth().height(260.dp),
) {
    val context = LocalContext.current
    Configuration.getInstance().userAgentValue = context.packageName

    // Keep the full report data untouched, but bound the amount of geometry rendered by
    // OSMDroid. This prevents a dense day of GPS points from blocking the Compose UI thread.
    val renderedSegments = remember(segments) { sampledSegments(segments) }
    val renderedMarkers = remember(markers) { markers.distinctBy { Triple(it.latitude, it.longitude, it.label) } }
    val allRenderedPoints = remember(renderedSegments, renderedMarkers) {
        buildList {
            renderedSegments.forEach { addAll(it) }
            addAll(renderedMarkers)
        }
    }
    val renderHash = remember(renderedSegments, renderedMarkers) {
        31 * renderedSegments.hashCode() + renderedMarkers.hashCode()
    }

    val map = remember {
        MapView(context).apply {
            setMultiTouchControls(true)
            setBuiltInZoomControls(true)
            controller.setZoom(16.0)
        }
    }
    val lastRenderHash = remember(map) { intArrayOf(Int.MIN_VALUE) }

    DisposableEffect(map) {
        map.onResume()
        onDispose {
            map.onPause()
            map.onDetach()
        }
    }

    AndroidView(
        factory = { map },
        modifier = modifier,
        update = { view ->
            if (lastRenderHash[0] != renderHash) {
                lastRenderHash[0] = renderHash
                view.overlays.clear()

                renderedSegments.forEach { segment ->
                    view.overlays.add(
                        Polyline().apply {
                            setPoints(segment.map { GeoPoint(it.latitude, it.longitude) })
                            outlinePaint.color = android.graphics.Color.rgb(25, 96, 180)
                            outlinePaint.strokeWidth = 7f
                        },
                    )
                }

                renderedMarkers.forEachIndexed { index, point ->
                    val marker = Marker(view).apply {
                        position = GeoPoint(point.latitude, point.longitude)
                        title = point.label ?: "Location ${index + 1}"
                        snippet = point.snippet
                        setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                    }
                    view.overlays.add(marker)
                    if (point.showInfo) marker.showInfoWindow()
                }

                if (allRenderedPoints.isNotEmpty()) {
                    if (allRenderedPoints.size == 1) {
                        view.controller.setCenter(GeoPoint(allRenderedPoints[0].latitude, allRenderedPoints[0].longitude))
                        view.controller.setZoom(17.0)
                    } else {
                        val north = allRenderedPoints.maxOf { it.latitude }
                        val south = allRenderedPoints.minOf { it.latitude }
                        val east = allRenderedPoints.maxOf { it.longitude }
                        val west = allRenderedPoints.minOf { it.longitude }
                        view.zoomToBoundingBox(BoundingBox(north, east, south, west), true, 64)
                    }
                }
                view.invalidate()
            }
        },
    )
}
