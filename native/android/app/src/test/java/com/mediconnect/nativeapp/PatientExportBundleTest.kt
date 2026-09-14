package com.mediconnect.nativeapp

import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.security.MessageDigest
import java.time.Instant
import java.util.Base64

class PatientExportBundleTest {
    private fun resource(name: String) = javaClass.classLoader!!.getResourceAsStream(name)!!.bufferedReader().use { it.readText() }
    private val fixture = JSONObject(resource("export-bundle.json"))
    private val original = Base64.getDecoder().decode(fixture.getString("bodyBase64"))
    private val contract = MobileContract(JSONObject(resource("mobile-contract.json")), JSONObject(resource("session-policy.json")))
    private val settings = JSONObject(resource("mobile-config.example.json"))
    private val owner = Identity(fixture.getString("subject"), Role.PATIENT, Instant.MAX)
    private val subjectField = contract.profiles.getValue(Role.PATIENT).subjectField
    private val maxBytes = settings.getLong("maxResponseBytes")
    private fun response(bytes: ByteArray = original) = NativeResponse(bytes, 200,
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) })
    private fun verify(value: NativeResponse, identity: Identity = owner, policy: PatientExportContract = contract.patientExport,
                       limit: Long = maxBytes) = PatientExportBundle.verifiedBytes(value, identity, policy, subjectField, limit)
    private fun changed(edit: (JSONObject) -> Unit): NativeResponse {
        val bundle = JSONObject(original.toString(Charsets.UTF_8)); edit(bundle)
        return response(bundle.toString().toByteArray())
    }
    private fun mutatePayload(bundle: JSONObject, index: Int = 0, edit: (JSONObject) -> Unit) {
        val binary = bundle.getJSONArray("entry").getJSONObject(index).getJSONObject("resource")
        val data = JSONObject(Base64.getDecoder().decode(binary.getString("data")).toString(Charsets.UTF_8))
        edit(data); binary.put("data", Base64.getEncoder().encodeToString(data.toString().toByteArray()))
    }

    @Test fun backendSerializerFixturePreservesExactBytes() {
        assertArrayEquals(original, verify(NativeResponse(original, 200, fixture.getString("integrity"))))
        val spaced = (" \n" + original.toString(Charsets.UTF_8) + "\n").toByteArray()
        assertArrayEquals(spaced, verify(response(spaced)))
    }

    @Test fun identityIntegrityAndLimitsAreMandatory() {
        for (identity in listOf(owner.copy(subject = "another-patient"), owner.copy(role = Role.DOCTOR),
            owner.copy(subject = ""), owner.copy(expiresAt = Instant.EPOCH))) {
            assertThrows(ApiFailure::class.java) { verify(response(), identity) }
        }
        assertThrows(ApiFailure::class.java) { verify(NativeResponse(original, 200, null)) }
        assertThrows(ApiFailure::class.java) { verify(NativeResponse(original, 206, fixture.getString("integrity"))) }
        assertThrows(ApiFailure::class.java) { verify(response(), limit = original.size.toLong() - 1) }
        assertThrows(ApiFailure::class.java) { verify(response(), policy = contract.patientExport.copy(maxJsonDepth = 1)) }
    }

    @Test fun wrongBundleBinaryAndEntryIdentityAreRejected() {
        val edits: List<(JSONObject) -> Unit> = listOf(
            { it.put("type", "transaction") }, { it.put("resourceType", "Patient") },
            { it.put("timestamp", "not-a-date") }, { it.put("unexpected", true) },
            { it.getJSONArray("entry").remove(0) },
            { it.getJSONArray("entry").put(it.getJSONArray("entry").getJSONObject(0)) },
            { it.getJSONArray("entry").getJSONObject(0).put("fullUrl", "https://example.invalid/patient") },
            { it.getJSONArray("entry").getJSONObject(0).getJSONObject("resource").put("resourceType", "Patient") },
            { it.getJSONArray("entry").getJSONObject(0).getJSONObject("resource").put("contentType", "text/plain") },
            { val entries = it.getJSONArray("entry"); entries.put(1, entries.getJSONObject(0)) },
        )
        for (edit in edits) assertThrows(ApiFailure::class.java) { verify(changed(edit)) }
    }

    @Test fun collectionShapeAndPatientBindingAreChecked() {
        val edits: List<(JSONObject) -> Unit> = listOf(
            { mutatePayload(it) { value -> value.getJSONObject("records").put(subjectField, "another-patient") } },
            { mutatePayload(it) { value -> value.getJSONObject("records").put(subjectField, 123) } },
            { mutatePayload(it) { value -> value.remove("records") } },
            { mutatePayload(it) { value -> value.put("collection", "unexpected") } },
            { mutatePayload(it, 1) { value -> value.put("collection", contract.patientExport.ownerCollection) } },
            { mutatePayload(it, 1) { value -> value.put("records", JSONObject()) } },
        )
        for (edit in edits) assertThrows(ApiFailure::class.java) { verify(changed(edit)) }
    }

    @Test fun strictJsonUtf8Base64AndDuplicateMembersAreRequired() {
        val body = original.toString(Charsets.UTF_8)
        val malformed = listOf("$body {}", body.dropLast(1) + ",}", body.replaceFirst("{", "{\"type\":\"collection\","))
        for (text in malformed) assertThrows(ApiFailure::class.java) { verify(response(text.toByteArray())) }
        assertThrows(ApiFailure::class.java) { verify(response(byteArrayOf(0xc3.toByte(), 0x28))) }
        for (data in listOf("!not-base64!", "", "e30", "e30=\n")) {
            assertThrows(ApiFailure::class.java) { verify(changed { it.getJSONArray("entry").getJSONObject(0).getJSONObject("resource").put("data", data) }) }
        }
        for (payload in listOf(
            "{\"collection\":\"patient\",\"records\":{\"patientId\":\"test-patient\",\"patientId\":\"test-patient\"}}",
            "{\"collection\":\"patient\",\"records\":{\"patientId\":\"test-patient\",\"name\":\"\\ud800\"}}",
            "{\"collection\":\"patient\",\"records\":{\"patientId\":\"test-patient\",\"x\":[{\"a\":1,\"a\":2}]}}",
        )) {
            assertThrows(ApiFailure::class.java) { verify(changed { it.getJSONArray("entry").getJSONObject(0).getJSONObject("resource")
                .put("data", Base64.getEncoder().encodeToString(payload.toByteArray())) }) }
        }
    }
}
