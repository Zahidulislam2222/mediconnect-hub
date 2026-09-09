package com.mediconnect.nativeapp

import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.time.Instant
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

class NativeApi(private val config: MobileConfiguration, private val sessions: SessionProvider, private val client: OkHttpClient) {
    suspend fun request(identity: Identity, service: String, path: String, query: Map<String, String> = emptyMap(), body: JSONObject? = null): String {
        val session = sessions.fetch()
        require(session.identity.subject == identity.subject && session.identity.role == identity.role && session.identity.expiresAt > Instant.now())
        require(path.matches(Regex("/[A-Za-z0-9/_.-]+")) && !path.contains("//") && !path.split('/').contains(".."))
        val base = config.services[service] ?: throw ApiFailure()
        val url = base.newBuilder().encodedPath(base.encodedPath.trimEnd('/') + path)
        query.forEach { (key, value) -> url.addQueryParameter(key, value) }
        val builder = Request.Builder().url(url.build())
            .header("Authorization", "Bearer ${session.token}").header("x-user-region", config.residency)
            .header("Accept", "application/json").header("Cache-Control", "no-store")
        if (body == null) builder.get() else builder.post(body.toString().toRequestBody("application/json".toMediaType()))
        return execute(client.newCall(builder.build()))
    }

    private suspend fun execute(call: Call): String = suspendCancellableCoroutine { continuation ->
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (continuation.isActive) continuation.resumeWithException(ApiFailure())
            }
            override fun onResponse(call: Call, response: Response) {
                response.use {
                    try {
                        if (!it.isSuccessful) throw ApiFailure(it.code)
                        val body = it.body
                        if (body.contentLength() > config.maxResponseBytes) throw ApiFailure()
                        val source = body.source()
                        source.request(config.maxResponseBytes + 1)
                        if (source.buffer.size > config.maxResponseBytes) throw ApiFailure()
                        val text = source.readUtf8()
                        if (continuation.isActive) continuation.resume(text)
                    } catch (_: Exception) {
                        if (continuation.isActive) continuation.resumeWithException(ApiFailure(it.code))
                    }
                }
            }
        })
    }
}
