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

class AppointmentsTransportTest {
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
    @Test fun bothRegionsSendCurrentSdkSessionAndCorrectSubject() = runBlocking {
        for (region in listOf("US", "EU")) {
            server.enqueue(MockResponse().setBody("{\"existingBookings\":[]}"))
            assertEquals(emptyList<Appointment>(), api(region).load(identity).items)
            val request = server.takeRequest(2, TimeUnit.SECONDS)!!
            assertEquals("Bearer test-token", request.getHeader("Authorization"))
            assertEquals(region, request.getHeader("x-user-region"))
            assertEquals("no-store", request.getHeader("Cache-Control"))
            assertEquals("/appointments?patientId=test-patient", request.path)
        }
        assertEquals(2, fetchCount)
    }
    @Test fun redirectCannotForwardCredentials() {
        server.enqueue(MockResponse().setResponseCode(302).setHeader("Location", "https://other.example.test"))
        val failure = assertThrows(ApiFailure::class.java) { runBlocking { api().load(identity) } }
        assertEquals(302, failure.status)
        assertEquals(1, server.requestCount)
    }
    @Test fun authorizationFailureDoesNotRetry() {
        server.enqueue(MockResponse().setResponseCode(403))
        val failure = assertThrows(ApiFailure::class.java) { runBlocking { api().load(identity) } }
        assertEquals(403, failure.status)
        assertEquals(1, server.requestCount)
    }
    @Test fun responseLimitRejectsOversizedBody() {
        server.enqueue(MockResponse().setBody(" ".repeat(256)))
        val failure = assertThrows(ApiFailure::class.java) { runBlocking { api(maxBytes = 128).load(identity) } }
        assertEquals(200, failure.status)
        assertEquals(1, server.requestCount)
    }
    @Test fun fullBodyDeadlineStopsStalledRead() {
        server.enqueue(MockResponse().setBody("{\"existingBookings\":[]}").throttleBody(1, 4, TimeUnit.SECONDS))
        val started = System.nanoTime()
        assertThrows(ApiFailure::class.java) { runBlocking { api(timeoutSeconds = 2).load(identity) } }
        assertEquals(1, server.requestCount)
        assertFalse(TimeUnit.NANOSECONDS.toSeconds(System.nanoTime() - started) > 7)
    }
    @Test fun changedSessionCannotFetchPreviousSubject() {
        assertThrows(IllegalArgumentException::class.java) {
            runBlocking { api().load(Identity("other-patient", Role.PATIENT, identity.expiresAt)) }
        }
        assertEquals(0, server.requestCount)
    }
}
