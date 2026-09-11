package com.mediconnect.nativeapp

import org.json.JSONObject

data class PatientSettingsSnapshot(val subject: String, val name: String, val email: String,
                                   val phone: String?, val address: String?, val preferences: Map<String, Boolean>?)
data class PatientSettingsDraft(val name: String, val phone: String?, val address: String?,
                                val preferences: Map<String, Boolean>?) {
    constructor(snapshot: PatientSettingsSnapshot) : this(snapshot.name, snapshot.phone, snapshot.address, snapshot.preferences)
}

object PatientSettingsData {
    private val preferenceKeys = setOf("email", "sms", "promotional")
    fun preferenceNames(): List<String> = preferenceKeys.toList()
    fun decode(row: JSONObject, identity: Identity, subjectField: String): PatientSettingsSnapshot {
        require(identity.role == Role.PATIENT)
        fun requiredString(key: String): String {
            val value = row.get(key)
            require(value is String && value.isNotBlank())
            return value
        }
        fun optionalString(key: String): String? {
            if (!row.has(key) || row.isNull(key)) return null
            val value = row.get(key); require(value is String); return value
        }
        val subject = requiredString(subjectField)
        require(subject == identity.subject)
        val preferences = if (!row.has("preferences") || row.isNull("preferences")) null else {
            val values = row.get("preferences"); require(values is JSONObject)
            values.keys().asSequence().associateWith { key ->
                require(key in preferenceKeys)
                val value = values.get(key); require(value is Boolean); value
            }
        }
        return PatientSettingsSnapshot(subject, requiredString("name"), requiredString("email"),
            optionalString("phone"), optionalString("address"), preferences)
    }

    fun changes(snapshot: PatientSettingsSnapshot, draft: PatientSettingsDraft, maxNameLength: Int): JSONObject {
        require(maxNameLength > 0 && draft.name.isNotBlank() && draft.name.length <= maxNameLength)
        require(draft.preferences == null || draft.preferences.keys.all { it in preferenceKeys })
        val body = JSONObject()
        if (draft.name != snapshot.name) body.put("name", draft.name)
        if (draft.phone != snapshot.phone) { require(draft.phone != null); body.put("phone", draft.phone) }
        if (draft.address != snapshot.address) { require(draft.address != null); body.put("address", draft.address) }
        if (draft.preferences != snapshot.preferences) {
            require(draft.preferences != null)
            require(snapshot.preferences == null || draft.preferences.keys.containsAll(snapshot.preferences.keys))
            body.put("preferences", JSONObject(draft.preferences))
        }
        return body
    }
}
