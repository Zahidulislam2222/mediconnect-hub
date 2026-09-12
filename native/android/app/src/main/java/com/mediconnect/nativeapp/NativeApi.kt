package com.mediconnect.nativeapp

import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONObject
import com.google.gson.Strictness
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonToken
import java.io.IOException
import java.io.StringReader
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.time.Instant
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

enum class NativeHttpMethod { GET, POST, PUT, DELETE }

// Fixed backend wire outcomes; arbitrary server text is never retained in failures.
enum class NativeFailureOutcome {
    ERASURE_IN_PROGRESS, ERASURE_REQUEST_CHANGED, ERASURE_RETRY_REQUIRED, EXPORT_INCOMPLETE;

    companion object {
        fun decode(status: Int, body: String): NativeFailureOutcome? = try {
            // Use the same strict reader on the JVM and Android. JSONObject accepts
            // non-JSON syntax and silently ignores trailing input on some runtimes.
            val value = mutableMapOf<String, String?>()
            JsonReader(StringReader(body)).use { reader ->
                reader.strictness = Strictness.STRICT
                reader.beginObject()
                while (reader.hasNext()) {
                    val name = reader.nextName()
                    require(!value.containsKey(name))
                    value[name] = if (reader.peek() == JsonToken.STRING) reader.nextString()
                    else { reader.skipValue(); null }
                }
                reader.endObject()
                require(reader.peek() == JsonToken.END_DOCUMENT)
            }
            val state = value["status"]
            val code = value["code"]
            when {
                status == 409 && !value.containsKey("code") && state == "IN_PROGRESS" -> ERASURE_IN_PROGRESS
                status == 409 && !value.containsKey("code") && state == "REQUEST_CHANGED" -> ERASURE_REQUEST_CHANGED
                status == 503 && state == "RETRY_REQUIRED" && code == "ERASURE_INCOMPLETE" -> ERASURE_RETRY_REQUIRED
                status == 503 && !value.containsKey("status") && code == "DATA_EXPORT_INCOMPLETE" -> EXPORT_INCOMPLETE
                else -> null
            }
        } catch (_: Exception) { null }
    }
}

class NativeResponse(body: ByteArray, val status: Int, val exportIntegrity: String?) {
    private val retainedBytes = body.copyOf()
    val body: String get() = retainedBytes.toString(StandardCharsets.UTF_8)
    val bytes: ByteArray get() = retainedBytes.copyOf()
}

class NativeApi(private val config: MobileConfiguration, private val sessions: SessionProvider, private val client: OkHttpClient) {
    suspend fun request(identity: Identity, service: String, path: String, query: Map<String, String> = emptyMap(), body: JSONObject? = null, method: NativeHttpMethod? = null): String =
        requestResponse(identity, service, path, query, body, method).body

    suspend fun requestResponse(identity: Identity, service: String, path: String, query: Map<String, String> = emptyMap(), body: JSONObject? = null, method: NativeHttpMethod? = null): NativeResponse {
        val selectedMethod = method ?: if (body == null) NativeHttpMethod.GET else NativeHttpMethod.POST
        require(when (selectedMethod) {
            NativeHttpMethod.GET -> body == null
            NativeHttpMethod.POST, NativeHttpMethod.PUT -> body != null
            NativeHttpMethod.DELETE -> true
        })
        val session = sessions.fetch()
        require(session.identity.subject == identity.subject && session.identity.role == identity.role && session.identity.expiresAt > Instant.now())
        require(path.matches(Regex("/[A-Za-z0-9/_.-]+")) && !path.contains("//") && !path.split('/').contains(".."))
        val base = config.services[service] ?: throw ApiFailure()
        val url = base.newBuilder().encodedPath(base.encodedPath.trimEnd('/') + path)
        query.forEach { (key, value) -> url.addQueryParameter(key, value) }
        val builder = Request.Builder().url(url.build())
            .header("Authorization", "Bearer ${session.token}").header("x-user-region", config.residency)
            .header("Accept", "application/json").header("Cache-Control", "no-store")
        builder.method(selectedMethod.name, body?.toString()?.toRequestBody("application/json".toMediaType()))
        return execute(client.newCall(builder.build()))
    }

    private suspend fun execute(call: Call): NativeResponse = suspendCancellableCoroutine { continuation ->
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (continuation.isActive) continuation.resumeWithException(ApiFailure())
            }
            override fun onResponse(call: Call, response: Response) {
                response.use {
                    try {
                        val body = it.body
                        if (body.contentLength() > config.maxResponseBytes) throw ApiFailure()
                        val source = body.source()
                        source.request(config.maxResponseBytes + 1)
                        if (source.buffer.size > config.maxResponseBytes) throw ApiFailure()
                        val bytes = source.readByteArray()
                        val text = if (it.isSuccessful) bytes.toString(StandardCharsets.UTF_8) else StandardCharsets.UTF_8.newDecoder()
                            .onMalformedInput(CodingErrorAction.REPORT)
                            .onUnmappableCharacter(CodingErrorAction.REPORT)
                            .decode(ByteBuffer.wrap(bytes)).toString()
                        if (!it.isSuccessful) throw ApiFailure(it.code, NativeFailureOutcome.decode(it.code, text))
                        val integrity = it.headers.values("X-Export-Integrity").singleOrNull()
                        if (continuation.isActive) continuation.resume(NativeResponse(bytes, it.code, integrity))
                    } catch (failure: Exception) {
                        if (continuation.isActive) continuation.resumeWithException(
                            if (failure is ApiFailure) ApiFailure(it.code, failure.outcome) else ApiFailure(it.code))
                    }
                }
            }
        })
    }
}
