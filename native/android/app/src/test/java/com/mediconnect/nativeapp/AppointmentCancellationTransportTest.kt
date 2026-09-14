package com.mediconnect.nativeapp

import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.tls.HandshakeCertificates
import okhttp3.tls.HeldCertificate
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import java.time.Instant
import java.util.concurrent.TimeUnit

class AppointmentCancellationTransportTest {
    private val certificate = HeldCertificate.Builder().addSubjectAlternativeName("localhost").build()
    private val serverCertificates = HandshakeCertificates.Builder().heldCertificate(certificate).build()
    private val clientCertificates = HandshakeCertificates.Builder().addTrustedCertificate(certificate.certificate).build()
    private val server = MockWebServer()
    private val identity = Identity("test-patient", Role.PATIENT, Instant.now().plusSeconds(300))
    private var fetchCount = 0
    private val provider = object : SessionProvider {
        override suspend fun fetch(): SessionAccess { fetchCount++; return SessionAccess(identity, "test-token") }
    }
    @Before fun start() { server.useHttps(serverCertificates.sslSocketFactory(), false); server.start() }
    @After fun stop() { server.shutdown() }
    private fun resource(name: String) = javaClass.classLoader!!.getResourceAsStream(name)!!.bufferedReader().use { it.readText() }
    private fun api(residency: String = "US", maxBytes: Int = 1048576, timeoutSeconds: Int = 10): AppointmentsApi {
        val source = JSONObject(resource("mobile-config.example.json"))
        source.put("requestTimeoutSeconds", timeoutSeconds).put("maxResponseBytes", maxBytes)
        val region = source.getJSONObject("regions").getJSONObject(residency)
        val awsRegion = if (residency == "US") "us-east-1" else "eu-central-1"
        region.put("awsRegion", awsRegion).put("userPoolId", "${awsRegion}_testpool")
            .put("clientId", "testclient").put("issuer", "https://example.test/testpool")
        val services = region.getJSONObject("services")
        services.keys().asSequence().toList().forEach { services.put(it, server.url("/").toString()) }
        val config = MobileConfiguration(source, residency)
        val contract = MobileContract(JSONObject(resource("mobile-contract.json")), JSONObject(resource("session-policy.json")))
        val client = NativeHttp.client(config).newBuilder().sslSocketFactory(clientCertificates.sslSocketFactory(), clientCertificates.trustManager).build()
        return AppointmentsApi(config, contract, provider, client)
    }

    private fun row(subject: String = identity.subject) = """{"appointmentId":"test-appointment","patientId":"$subject","status":"CONFIRMED"}"""
    @Test fun bothRegionsFindOwnedAppointmentThroughPaginationWithFreshTokens() = runBlocking {
        for (region in listOf("US", "EU")) {
            server.enqueue(MockResponse().setBody("""{"appointments":[],"lastEvaluatedKey":{"appointmentId":"test-cursor"}}"""))
            server.enqueue(MockResponse().setBody("[${row()}]"))
            assertEquals("test-appointment", api(region).find(identity, "test-appointment").id)
            val first = server.takeRequest(2, TimeUnit.SECONDS)!!
            val second = server.takeRequest(2, TimeUnit.SECONDS)!!
            assertEquals(identity.subject, first.requestUrl!!.queryParameter("patientId"))
            assertEquals("test-cursor", JSONObject(second.requestUrl!!.queryParameter("startKey")!!).getString("appointmentId"))
            assertEquals(region, second.getHeader("x-user-region")); assertEquals("Bearer test-token", second.getHeader("Authorization"))
        }
        assertEquals(4, fetchCount)
    }
    @Test fun cancellationPostContainsOnlyAppointmentIdAndNeverTrustsResponseCopy() = runBlocking {
        server.enqueue(MockResponse().setBody("""{"message":"test-unverified-refund-claim"}"""))
        api().cancel(identity, "test-appointment")
        val request = server.takeRequest(2, TimeUnit.SECONDS)!!
        assertEquals("POST", request.method); assertEquals("/appointments/cancel", request.path)
        val body = JSONObject(request.body.readUtf8()); assertEquals(setOf("appointmentId"), body.keys().asSequence().toSet())
        assertEquals("test-appointment", body.getString("appointmentId")); assertEquals("no-store", request.getHeader("Cache-Control"))
    }
    @Test fun foreignSubjectAndMissingRowsCannotBeReturned() {
        server.enqueue(MockResponse().setBody("[${row("other-patient")}]"))
        assertThrows(Exception::class.java) { runBlocking { api().find(identity, "test-appointment") } }
        server.enqueue(MockResponse().setBody("[]"))
        val failure = assertThrows(ApiFailure::class.java) { runBlocking { api().find(identity, "test-appointment") } }
        assertEquals(404, failure.status)
    }
    @Test fun repeatedPaginationCursorFailsWithoutUnboundedRequests() {
        repeat(2) { server.enqueue(MockResponse().setBody("""{"appointments":[],"lastEvaluatedKey":{"appointmentId":"test-cursor"}}""")) }
        assertThrows(Exception::class.java) { runBlocking { api().find(identity, "test-appointment") } }
        assertEquals(2, server.requestCount)
    }
    @Test fun redirectNeverReplaysMutation() {
        server.enqueue(MockResponse().setResponseCode(307).setHeader("Location", "https://other.example.test"))
        assertThrows(ApiFailure::class.java) { runBlocking { api().cancel(identity, "test-appointment") } }
        assertEquals(1, server.requestCount)
    }
    @Test fun changedIdentityOrWrongRoleCannotSubmit() {
        for (value in listOf(identity.copy(subject = "other-patient"), identity.copy(role = Role.DOCTOR))) {
            assertThrows(Exception::class.java) { runBlocking { api().cancel(value, "test-appointment") } }
        }
        assertEquals(0, server.requestCount)
    }
}
