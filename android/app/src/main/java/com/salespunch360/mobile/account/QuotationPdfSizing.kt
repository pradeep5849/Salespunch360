package com.salespunch360.mobile.account

/** Bound one visible PDF page's bitmap while preserving its aspect ratio. */
fun quotationPdfPageSize(width:Int,height:Int,maxEdge:Int=1600):Pair<Int,Int>{
 require(width>0&&height>0&&maxEdge>0){"Invalid PDF page size"}
 val scale=maxEdge.toDouble()/maxOf(width,height)
 return maxOf(1,(width*scale).toInt()) to maxOf(1,(height*scale).toInt())
}
