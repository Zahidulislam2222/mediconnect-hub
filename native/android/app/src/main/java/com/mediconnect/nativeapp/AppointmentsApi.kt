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

class AppointmentsApi(config: MobileConfiguration, private val contract: MobileContract,
                      sessions: SessionProvider, client: OkHttpClient) {
    private val transport = NativeApi(config, sessions, client)
    suspend fun load(identity: Identity, cursor: String? = null): AppointmentPage {
        val subjectKey = contract.appointmentQueries[identity.role] ?: throw ApiFailure(403)
        val query = mutableMapOf(subjectKey to identity.subject)
        if (cursor != null) query["startKey"] = cursor
        return AppointmentDecoder.decode(transport.request(identity, contract.appointmentService, contract.appointmentPath, query), identity, contract)
    }
}
