package com.salespunch360.mobile.web

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.webkit.CookieManager
import android.webkit.URLUtil
import android.widget.Toast
import androidx.annotation.RequiresApi
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

object AccountDownloadManager {
    private val http = OkHttpClient()

    fun download(
        context: Context,
        url: String,
        userAgent: String?,
        contentDisposition: String?,
        mimeType: String?,
    ) {
        if (!isAllowedAccountDownloadUrl(url)) return

        val app = context.applicationContext
        val cookie = CookieManager.getInstance().getCookie(ACCOUNT_ORIGIN)
        val fileName = safeFileName(URLUtil.guessFileName(url, contentDisposition, mimeType))

        CoroutineScope(Dispatchers.IO).launch {
            runCatching {
                val request = Request.Builder().url(url).apply {
                    if (!userAgent.isNullOrBlank()) header("User-Agent", userAgent)
                    if (!cookie.isNullOrBlank()) header("Cookie", cookie)
                }.build()

                http.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) error("download failed")
                    val body = response.body ?: error("empty download")
                    val type = mimeType?.takeIf { it.isNotBlank() }
                        ?: body.contentType()?.toString()
                        ?: "application/octet-stream"

                    body.byteStream().use { input ->
                        val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            saveToMediaStore(app, fileName, type, input)
                        } else {
                            saveToAppStorage(app, fileName, input)
                        }

                        withContext(Dispatchers.Main) {
                            Toast.makeText(context, "Saved $fileName", Toast.LENGTH_SHORT).show()
                            openDownloaded(context, uri, type)
                        }
                    }
                }
            }.onFailure {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Download could not be completed.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    private fun saveToMediaStore(
        context: Context,
        fileName: String,
        mimeType: String,
        input: InputStream,
    ): Uri {
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, fileName)
            put(MediaStore.Downloads.MIME_TYPE, mimeType)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/SalesPunch360")
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: error("download destination unavailable")

        try {
            resolver.openOutputStream(uri)?.use { output ->
                copy(input, output)
            } ?: error("download stream unavailable")

            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            return uri
        } catch (error: Throwable) {
            resolver.delete(uri, null, null)
            throw error
        }
    }

    private fun saveToAppStorage(
        context: Context,
        fileName: String,
        input: InputStream,
    ): Uri {
        val directory = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            ?: context.filesDir
        val file = File(directory, fileName)
        FileOutputStream(file).use { output -> copy(input, output) }
        return FileProvider.getUriForFile(context, context.packageName + ".files", file)
    }

    private fun copy(input: InputStream, output: OutputStream) {
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) return
            output.write(buffer, 0, count)
        }
    }

    private fun openDownloaded(context: Context, uri: Uri, mimeType: String) {
        val intent = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, mimeType)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        runCatching { context.startActivity(intent) }
    }

    private fun safeFileName(value: String): String =
        value.replace(Regex("[^A-Za-z0-9._ -]"), "_")
            .take(120)
            .ifBlank { "salespunch360-download" }
}
