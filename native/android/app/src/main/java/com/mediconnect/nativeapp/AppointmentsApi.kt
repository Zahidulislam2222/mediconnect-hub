package com.mediconnect.nativeapp

import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.IOException
import java.time.Instant
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class Appointment(val id: String, val time: Instant?, val person: String?, val status: String?)
data class AppointmentPage(val items: List<Appointment>, val next: String?)
class ApiFailure(val status: Int? = null) : IOException("REQUEST_UNAVAILABLE")

object AppointmentDecoder {
    fun decode(body: String, identity: Identity, contract: MobileContract): AppointmentPage {
        val source = JSONTokener(body).nextValue()
        val rows: JSONArray = when (source) {
            is JSONArray -> source
            is JSONObject -> contract.appointmentListKeys.firstNotNullOfOrNull { source.optJSONArray(it) }
                ?: throw ApiFailure()
            else -> throw ApiFailure()
        }
        val items = (0 until rows.length()).map { index ->
            val row = rows.getJSONObject(index)
            val subjectField = contract.appointmentQueries[identity.role] ?: throw ApiFailure()
            require(row.getString(subjectField) == identity.subject) { "SUBJECT_MISMATCH" }
            fun text(key: String) = (row.opt(key) as? String)?.trim()?.takeIf { it.isNotEmpty() }
            val id = text("appointmentId") ?: throw ApiFailure()
            val rawTime = text("timeSlot") ?: row.optJSONObject("resource")?.optString("start")
            val time = rawTime?.let { runCatching { Instant.parse(it) }.getOrNull() }
            Appointment(id, time, text(if (identity.role == Role.PATIENT) "doctorName" else "patientName"), text("status"))
        }
        require(items.map { it.id }.toSet().size == items.size)
        val cursor = (source as? JSONObject)?.optJSONObject("lastEvaluatedKey")?.takeIf { it.length() > 0 }?.toString()
        return AppointmentPage(items, cursor)
    }
}

class AppointmentsApi(private val config: MobileConfiguration, private val contract: MobileContract,
                      private val sessions: SessionProvider, private val client: OkHttpClient) {
    suspend fun load(identity: Identity, cursor: String? = null): AppointmentPage {
        val session = sessions.fetch()
        require(session.identity.subject == identity.subject && session.identity.role == identity.role)
        val subjectKey = contract.appointmentQueries[identity.role] ?: throw ApiFailure(403)
        val base = config.services[contract.appointmentService] ?: throw ApiFailure()
        val builder = base.newBuilder().encodedPath(base.encodedPath.trimEnd('/') + contract.appointmentPath)
            .addQueryParameter(subjectKey, identity.subject)
        if (cursor != null) builder.addQueryParameter("startKey", cursor)
        val request = Request.Builder().url(builder.build()).get()
            .header("Authorization", "Bearer ${session.token}").header("x-user-region", config.residency)
            .header("Accept", "application/json").header("Cache-Control", "no-store").build()
        val body = execute(client.newCall(request))
        return AppointmentDecoder.decode(body, identity, contract)
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
