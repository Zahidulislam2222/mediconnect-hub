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

class PatientSettingsTransportTest {
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
    private fun api(residency: String = "US", maxBytes: Int = 1048576, timeoutSeconds: Int = 10): PatientSettingsApi {
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
        return PatientSettingsApi(NativeApi(config, provider, client), contract)
    }
    private fun profile() = PatientSettingsSnapshot(identity.subject, "Test person", "test@example.test", null, null, null)
    @Test fun bothRegionsLoadAndSaveOnlyChangedFieldsWithFreshTokens() = runBlocking {
        for (region in listOf("US", "EU")) {
            val client = api(region)
            server.enqueue(MockResponse().setBody("{\"patientId\":\"test-patient\",\"name\":\"Test person\",\"email\":\"test@example.test\"}"))
            val snapshot = client.load(identity)
            assertEquals(profile(), snapshot)
            val read = server.takeRequest(2, TimeUnit.SECONDS)!!
            assertEquals("GET", read.method); assertEquals("/me", read.path)
            server.enqueue(MockResponse().setBody("{}"))
            client.save(identity, snapshot, PatientSettingsDraft(snapshot).copy(address = "Test address"))
            val sent = server.takeRequest(2, TimeUnit.SECONDS)!!
            assertEquals("PUT", sent.method); assertEquals("/patients/test-patient", sent.path)
            assertEquals(region, sent.getHeader("x-user-region"))
            assertEquals("Bearer test-token", sent.getHeader("Authorization"))
            assertEquals(setOf("address"), JSONObject(sent.body.readUtf8()).keys().asSequence().toSet())
        }
        assertEquals(4, fetchCount)
    }
    @Test fun unchangedDraftDoesNotSendMutation() = runBlocking {
        val snapshot = profile()
        api().save(identity, snapshot, PatientSettingsDraft(snapshot))
        assertEquals(0, server.requestCount); assertEquals(0, fetchCount)
    }
    @Test fun foreignOwnerAndChangedSdkIdentityCannotWrite() {
        val draft = PatientSettingsDraft(profile()).copy(name = "Changed name")
        assertThrows(IllegalArgumentException::class.java) {
            runBlocking { api().save(identity, profile().copy(subject = "other"), draft) }
        }
        val changed = identity.copy(subject = "other")
        assertThrows(IllegalArgumentException::class.java) {
            runBlocking { api().save(changed, profile().copy(subject = "other"), draft) }
        }
        assertEquals(0, server.requestCount)
    }
    @Test fun denialIsPropagatedWithoutFalseSaveSuccess() {
        server.enqueue(MockResponse().setResponseCode(403).setBody("{}"))
        val failure = assertThrows(ApiFailure::class.java) {
            runBlocking { api().save(identity, profile(), PatientSettingsDraft(profile()).copy(name = "Changed")) }
        }
        assertEquals(403, failure.status)
        assertEquals(1, server.requestCount)
    }
}
