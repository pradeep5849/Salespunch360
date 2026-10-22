package com.salespunch360.mobile.account
import kotlinx.serialization.json.JsonObject
/** Saved legacy accent colours survive opening the new named-layout picker. */
fun quotationThemeSelection(data:JsonObject):Pair<String,String>{
 val current=data["current"] as? JsonObject;val saved=current?.str("theme").orEmpty();val themes=data.array("themes")
 val theme=themes.firstOrNull{it.str("id")==saved}?.str("id")?:themes.firstOrNull()?.str("id").orEmpty()
 val validColor=Regex("^#[0-9a-fA-F]{6}$")
 val color=current?.str("color")?.takeIf{validColor.matches(it)}?:saved.takeIf{validColor.matches(it)}?:"#998BDF"
 return theme to color.uppercase()
}
