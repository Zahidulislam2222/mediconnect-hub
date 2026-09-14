package com.mediconnect.nativeapp

import android.content.ContentResolver
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlin.coroutines.coroutineContext

/** Writes only to the new document explicitly selected through ACTION_CREATE_DOCUMENT. */
object PatientExportDocument {
    const val mimeType = "application/json"
    const val extension = ".json"
    suspend fun write(resolver: ContentResolver, destination: Uri, bytes: ByteArray, valid: () -> Unit) {
        require(destination.scheme == "content")
        withContext(Dispatchers.IO) {
            coroutineContext.ensureActive(); valid()
            val stream = resolver.openOutputStream(destination, "wt") ?: throw java.io.IOException()
            stream.use {
                var offset = 0
                while (offset < bytes.size) {
                    coroutineContext.ensureActive(); valid()
                    val count = minOf(DEFAULT_BUFFER_SIZE, bytes.size - offset)
                    it.write(bytes, offset, count); offset += count
                }
                coroutineContext.ensureActive(); valid(); it.flush()
            }
            coroutineContext.ensureActive(); valid()
        }
    }
}
