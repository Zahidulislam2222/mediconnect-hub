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

class ProfileTransportTest {
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
    private fun api(residency: String = "US", maxBytes: Int = 1048576, timeoutSeconds: Int = 10): ProfileApi {
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
        return ProfileApi(NativeApi(config, provider, client), contract)
    }
    @Test fun bothRegionsReadSelfProfileWithFreshSdkToken() = runBlocking {
        for (region in listOf("US", "EU")) {
            server.enqueue(MockResponse().setBody("{\"patientId\":\"test-patient\",\"name\":\"Test person\",\"email\":\"test-user@example.test\"}"))
            assertEquals(identity.subject, api(region).load(identity).subject)
            val request = server.takeRequest(2, TimeUnit.SECONDS)!!
            assertEquals("/me", request.path); assertEquals(region, request.getHeader("x-user-region"))
            assertEquals("Bearer test-token", request.getHeader("Authorization")); assertEquals("no-store", request.getHeader("Cache-Control"))
        }
        assertEquals(2, fetchCount)
    }
    @Test fun createSendsOnlyDetailsAndExplicitVersionedConsent() = runBlocking {
        server.enqueue(MockResponse().setBody("{}"))
        api().create(identity, ProfileDetails("Test person", "test-user@example.test", ""), "test-policy")
        val request = server.takeRequest(2, TimeUnit.SECONDS)!!
        assertEquals("POST", request.method); assertEquals("/register-patient", request.path)
        val body = JSONObject(request.body.readUtf8())
        assertEquals(setOf("name", "email", "consentDetails"), body.keys().asSequence().toSet())
        assertEquals("test-policy", body.getJSONObject("consentDetails").getString("policyVersion"))
        assertEquals(true, body.getJSONObject("consentDetails").getBoolean("agreedToTerms"))
        assertEquals(1, server.requestCount)
    }
    @Test fun malformedOrForeignProfileIsNotMissing() {
        for (body in listOf("{}", "not-json", "{\"patientId\":\"other-patient\",\"name\":\"Test person\",\"email\":\"test-user@example.test\"}")) {
            server.enqueue(MockResponse().setBody(body))
            assertThrows(Exception::class.java) { runBlocking { api().load(identity) } }
        }
        assertEquals(3, server.requestCount)
    }
    @Test fun redirectOnCreateDoesNotForwardCredentialsOrRepeatPost() {
        server.enqueue(MockResponse().setResponseCode(307).setHeader("Location", "https://other.example.test"))
        val failure = assertThrows(ApiFailure::class.java) {
            runBlocking { api().create(identity, ProfileDetails("Test person", "test-user@example.test", ""), "test-policy") }
        }
        assertEquals(307, failure.status); assertEquals(1, server.requestCount)
    }
    @Test fun changedIdentityCannotSubmitPreviousProfile() {
        assertThrows(IllegalArgumentException::class.java) {
            runBlocking { api().create(identity.copy(subject = "other-patient"), ProfileDetails("Test person", "test-user@example.test", ""), "test-policy") }
        }
        assertEquals(0, server.requestCount)
    }
}
