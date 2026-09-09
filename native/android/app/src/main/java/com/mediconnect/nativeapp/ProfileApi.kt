package com.mediconnect.nativeapp

import org.json.JSONObject

class ProfileApi(private val transport: NativeApi, private val contract: MobileContract) : ProfileService {
    private fun route(identity: Identity) = contract.profiles[identity.role] ?: throw ApiFailure(403)
    override suspend fun load(identity: Identity): OwnProfile {
        val route = route(identity)
        val path = route.readPath + if (route.appendSubject) "/${identity.subject}" else ""
        val row = JSONObject(transport.request(identity, route.service, path))
        require(row.getString(route.subjectField) == identity.subject)
        val name = row.getString("name").trim(); val email = row.getString("email").trim()
        require(name.isNotEmpty() && email.isNotEmpty())
        return OwnProfile(identity.subject, name, email)
    }
    override suspend fun create(identity: Identity, details: ProfileDetails, policyVersion: String) {
        val route = route(identity)
        require(details.name.isNotBlank() && details.email.isNotBlank() && policyVersion.isNotBlank())
        val body = JSONObject().put("name", details.name).put("email", details.email)
            .put("consentDetails", JSONObject().put("agreedToTerms", true).put("policyVersion", policyVersion))
        if (identity.role == Role.DOCTOR) {
            require(details.specialization.isNotBlank())
            body.put("specialization", details.specialization)
        }
        transport.request(identity, route.service, route.createPath, body = body)
    }
}
