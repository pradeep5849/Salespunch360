package com.salespunch360.mobile.account

suspend fun <T> loadMasterPages(fetch: suspend (offset: Int) -> List<T>): List<T> {
    val rows = mutableListOf<T>()
    var offset = 0
    while (true) {
        val page = fetch(offset)
        rows.addAll(page)
        if (page.size < 200) return rows
        offset += page.size
    }
}
