package com.mediconnect.nativeapp

import org.json.JSONObject

interface PatientSettingsService {
    suspend fun load(identity: Identity): PatientSettingsSnapshot
    suspend fun save(identity: Identity, snapshot: PatientSettingsSnapshot, draft: PatientSettingsDraft)
}

class PatientSettingsApi(private val transport: NativeApi, private val contract: MobileContract) : PatientSettingsService {
    private fun route(identity: Identity): ProfileContract {
        require(identity.role == Role.PATIENT)
        return contract.profiles[Role.PATIENT] ?: throw ApiFailure(403)
    }
    override suspend fun load(identity: Identity): PatientSettingsSnapshot {
        val route = route(identity)
        val path = route.readPath + if (route.appendSubject) "/${identity.subject}" else ""
        return PatientSettingsData.decode(JSONObject(transport.request(identity, route.service, path)), identity, route.subjectField)
    }
    override suspend fun save(identity: Identity, snapshot: PatientSettingsSnapshot, draft: PatientSettingsDraft) {
        val route = route(identity)
        require(snapshot.subject == identity.subject)
        val changes = PatientSettingsData.changes(snapshot, draft, contract.patientSettings.maxNameLength)
        if (changes.length() == 0) return
        transport.request(identity, route.service, contract.patientSettings.updatePath + "/" + identity.subject,
            body = changes, method = NativeHttpMethod.PUT)
    }
}
