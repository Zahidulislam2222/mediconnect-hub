package com.mediconnect.nativeapp

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONObject

enum class Role(val key: String) {
    PATIENT("patient"), DOCTOR("doctor"), STAFF("staff"), ADMIN("admin");
    companion object { fun from(value: String) = entries.single { it.key == value } }
}

class MobileContent(private val source: JSONObject) {
    fun text(key: String): String = source.getString(key)
    fun label(group: String, key: String): String = source.getJSONObject(group).getString(key)
}

data class ProfileContract(val service: String, val readPath: String, val appendSubject: Boolean, val createPath: String, val subjectField: String)

data class CancellationContract(val path: String, val cancellableStatuses: Set<String>, val cancelledStatuses: Set<String>, val maxLookupPages: Int)

class MobileContract(source: JSONObject, policy: JSONObject) {
    val cancellation = source.getJSONObject("cancellation").let { row ->
        fun statuses(key: String) = row.getJSONArray(key).let { values -> (0 until values.length()).map { values.getString(it) }.toSet().also { require(it.isNotEmpty()) } }
        CancellationContract(row.getString("path").also { require(it.matches(Regex("/[A-Za-z0-9/_-]+")) && !it.contains("//")) },
            statuses("cancellableStatuses"), statuses("cancelledStatuses"), row.getInt("maxLookupPages").also { require(it > 0) })
    }
    val profiles = source.getJSONObject("profiles").let { profiles ->
        profiles.keys().asSequence().associate { key ->
            val row = profiles.getJSONObject(key)
            fun path(name: String) = row.getString(name).also { require(it.matches(Regex("/[A-Za-z0-9/_-]+")) && !it.contains("//")) }
            Role.from(key) to ProfileContract(row.getString("service"), path("readPath"), row.getBoolean("appendSubject"), path("createPath"), row.getString("subjectField"))
        }
    }
    val groups: Map<String, Role> = policy.getJSONObject("groups").let { groups ->
        groups.keys().asSequence().associateWith { Role.from(groups.getString(it)) }
    }
    val defaultRole = Role.from(policy.getString("defaultRole"))
    private val appointment = source.getJSONObject("appointments")
    val appointmentService = appointment.getString("service")
    val appointmentPath = appointment.getString("path").also {
        require(it.matches(Regex("/[A-Za-z0-9/_-]+")) && !it.contains("//"))
    }
    val appointmentQueries = appointment.getJSONObject("query").let { query ->
        query.keys().asSequence().associate { Role.from(it) to query.getString(it) }
    }
    val appointmentListKeys = appointment.getJSONArray("listKeys").let { list ->
        (0 until list.length()).map { list.getString(it) }
    }

    fun role(claims: JSONObject): Role {
        if (!claims.has("cognito:groups")) return defaultRole
        val groupsClaim = claims.getJSONArray("cognito:groups")
        val claimed = (0 until groupsClaim.length()).map { groupsClaim.getString(it) }
        if (claimed.isEmpty()) return defaultRole
        val roles = claimed.mapNotNull(groups::get).toSet()
        require(roles.size == 1) { "INVALID_ROLE" }
        return roles.single()
    }
}

/** Public deployment settings only. Private OAuth client secrets never belong in a mobile binary. */
class MobileConfiguration(source: JSONObject, val residency: String) {
    val requestTimeoutSeconds = source.getLong("requestTimeoutSeconds").also { require(it > 0) }
    val maxResponseBytes = source.getLong("maxResponseBytes").also { require(it > 0 && it < Int.MAX_VALUE) }
    private val region = source.getJSONObject("regions").getJSONObject(residency)
    val awsRegion = region.getString("awsRegion")
    val userPoolId = region.getString("userPoolId")
    val clientId = region.getString("clientId")
    val issuer = region.getString("issuer")
    val services = region.getJSONObject("services").let { services ->
        services.keys().asSequence().associateWith { secureBase(services.getString(it)) }
    }

    init {
        require(residency == "US" || residency == "EU")
        require(awsRegion.matches(Regex("[a-z]{2}-[a-z]+-[0-9]")))
        require(userPoolId.startsWith("${awsRegion}_") && userPoolId.matches(Regex("[a-zA-Z0-9_-]+")))
        require(clientId.matches(Regex("[a-z0-9]+")))
        secureBase(issuer)
    }

    companion object {
        fun secureBase(value: String): HttpUrl = value.toHttpUrl().also {
            require(it.isHttps && it.username.isEmpty() && it.password.isEmpty())
            require(it.query == null && it.fragment == null)
        }
    }
}
