package com.mediconnect.nativeapp

import org.json.JSONObject
import com.amplifyframework.auth.result.step.AuthSignInStep
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import java.time.Instant
import java.util.Base64

class NativeBoundaryTest {
    private fun resource(name: String) = javaClass.classLoader!!.getResourceAsStream(name)!!.bufferedReader().use { it.readText() }
    private fun contract() = MobileContract(JSONObject(resource("mobile-contract.json")), JSONObject(resource("session-policy.json")))
    private fun configSource() = JSONObject(resource("mobile-config.example.json")).apply {
        for (name in listOf("US", "EU")) {
            val region = getJSONObject("regions").getJSONObject(name)
            val awsRegion = if (name == "US") "us-east-1" else "eu-central-1"
            region.put("awsRegion", awsRegion).put("userPoolId", "${awsRegion}_testpool")
                .put("clientId", "testclient").put("issuer", "https://${name.lowercase()}.example.test/testpool")
            val services = region.getJSONObject("services")
            services.keys().asSequence().toList().forEach { services.put(it, "https://${name.lowercase()}.example.test") }
        }
    }
    private val now = Instant.parse("2026-09-10T00:00:00Z")
    private fun claims() = JSONObject().put("sub", "test-patient").put("exp", now.plusSeconds(60).epochSecond)
        .put("iss", "https://us.example.test/testpool").put("aud", "testclient").put("token_use", "id")
    private fun token(claims: JSONObject): String {
        val payload = Base64.getUrlEncoder().withoutPadding().encodeToString(claims.toString().toByteArray())
        return "test-header.$payload.test-signature"
    }
    private fun session(claims: JSONObject, residency: String = "US") =
        SessionClaims.fromSdkToken(token(claims), MobileConfiguration(configSource(), residency), contract(), now)

    @Test fun blankDeploymentBlocksConnections() {
        assertThrows(Exception::class.java) { MobileConfiguration(JSONObject(resource("mobile-config.example.json")), "US") }
    }
    @Test fun deploymentRejectsCleartextAndEmbeddedCredentials() {
        for (url in listOf("http://example.test", "https://test-user:test-value@example.test", "https://example.test/?query=value", "https://example.test/#fragment")) {
            assertThrows(Exception::class.java) { MobileConfiguration.secureBase(url) }
        }
    }
    @Test fun validPatientAndDoctorClaimsChooseTheirRole() {
        assertEquals(Role.PATIENT, session(claims()).identity.role)
        assertEquals(Role.DOCTOR, session(claims().put("cognito:groups", listOf("practitioner"))).identity.role)
    }
    @Test fun unknownAmbiguousAndMalformedRolesAreDenied() {
        for (groups in listOf(listOf("unknown"), listOf("patient", "admin"), "doctor", listOf(9))) {
            assertThrows(Exception::class.java) { session(claims().put("cognito:groups", groups)) }
        }
    }
    @Test fun expiredTokenIsDenied() {
        assertThrows(Exception::class.java) { session(claims().put("exp", now.epochSecond)) }
    }
    @Test fun foreignRegionalTokenIsDenied() {
        assertThrows(Exception::class.java) { session(claims(), "EU") }
    }
    @Test fun wrongAudienceAndAccessTokenAreDenied() {
        assertThrows(Exception::class.java) { session(claims().put("aud", "otherclient")) }
        assertThrows(Exception::class.java) { session(claims().put("token_use", "access")) }
    }
    @Test fun invalidSubjectIsDenied() {
        assertThrows(Exception::class.java) { session(claims().put("sub", "../another-patient")) }
    }
    @Test fun emptyResponseIsDifferentFromMalformedResponse() {
        val identity = session(claims()).identity
        assertEquals(emptyList<Appointment>(), AppointmentDecoder.decode("{\"existingBookings\":[]}", identity, contract()).items)
        for (body in listOf("{}", "null", "{\"existingBookings\":{}}")) {
            assertThrows(Exception::class.java) { AppointmentDecoder.decode(body, identity, contract()) }
        }
    }
    @Test fun anotherPatientRecordRejectsWholeResponse() {
        val body = """{"existingBookings":[{"appointmentId":"test-appointment","patientId":"another-patient"}]}"""
        assertThrows(Exception::class.java) { AppointmentDecoder.decode(body, session(claims()).identity, contract()) }
    }
    @Test fun missingClinicalFieldsStayMissing() {
        val body = """{"existingBookings":[{"appointmentId":"test-appointment","patientId":"test-patient","timeSlot":"invalid"}]}"""
        val item = AppointmentDecoder.decode(body, session(claims()).identity, contract()).items.single()
        assertNull(item.time)
        assertNull(item.person)
        assertNull(item.status)
    }
    @Test fun validAppointmentKeepsObservedTimeAndContinuation() {
        val body = """{"existingBookings":[{"appointmentId":"test-appointment","patientId":"test-patient","doctorName":"Test clinician","timeSlot":"2026-09-10T09:00:00Z","status":"CONFIRMED"}],"lastEvaluatedKey":{"appointmentId":"test-appointment"}}"""
        val page = AppointmentDecoder.decode(body, session(claims()).identity, contract())
        assertEquals(Instant.parse("2026-09-10T09:00:00Z"), page.items.single().time)
        assertEquals("Test clinician", page.items.single().person)
        assertEquals("test-appointment", JSONObject(page.next!!).getString("appointmentId"))
    }
    @Test fun duplicateAppointmentsAreRejected() {
        val row = """{"appointmentId":"test-appointment","patientId":"test-patient"}"""
        assertThrows(Exception::class.java) { AppointmentDecoder.decode("[$row,$row]", session(claims()).identity, contract()) }
    }
    @Test fun staffCannotLoadPatientAppointments() {
        assertNull(contract().appointmentQueries[Role.STAFF])
        assertNull(contract().appointmentQueries[Role.ADMIN])
    }
    @Test fun sdkEmailSmsAndTotpChallengesUseCodeEntry() {
        for (step in listOf(AuthSignInStep.CONFIRM_SIGN_IN_WITH_OTP, AuthSignInStep.CONFIRM_SIGN_IN_WITH_SMS_MFA_CODE, AuthSignInStep.CONFIRM_SIGN_IN_WITH_TOTP_CODE)) {
            assertEquals(true, SignInChallenge.needsCode(step))
        }
        assertEquals(false, SignInChallenge.needsCode(AuthSignInStep.CONFIRM_SIGN_IN_WITH_NEW_PASSWORD))
        assertEquals(false, SignInChallenge.needsCode(AuthSignInStep.CONTINUE_SIGN_IN_WITH_TOTP_SETUP))
    }
}
