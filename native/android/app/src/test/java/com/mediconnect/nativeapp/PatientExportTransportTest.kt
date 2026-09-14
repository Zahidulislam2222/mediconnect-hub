package com.mediconnect.nativeapp

import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.tls.HandshakeCertificates
import okhttp3.tls.HeldCertificate
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import java.time.Instant
import java.util.Base64
import java.util.concurrent.TimeUnit

class PatientExportTransportTest {
    private val certificate = HeldCertificate.Builder().addSubjectAlternativeName("localhost").build()
    private val serverCertificates = HandshakeCertificates.Builder().heldCertificate(certificate).build()
    private val clientCertificates = HandshakeCertificates.Builder().addTrustedCertificate(certificate.certificate).build()
    private val server = MockWebServer()
    private fun resource(name: String) = javaClass.classLoader!!.getResourceAsStream(name)!!.bufferedReader().use { it.readText() }
    private val fixture = JSONObject(resource("export-bundle.json"))
    private val bytes = Base64.getDecoder().decode(fixture.getString("bodyBase64"))
    private val owner = Identity(fixture.getString("subject"), Role.PATIENT, Instant.MAX)
    private val contract = MobileContract(JSONObject(resource("mobile-contract.json")), JSONObject(resource("session-policy.json")))
    private var sdkIdentity = owner
    private var fetches = 0
    private var replacementOnRecheck: Identity? = null
    private val provider = object : SessionProvider {
        override suspend fun fetch(): SessionAccess {
            fetches++
            return SessionAccess(if (fetches > 1) replacementOnRecheck ?: sdkIdentity else sdkIdentity, "test-token")
        }
    }
    @Before fun start() { server.useHttps(serverCertificates.sslSocketFactory(), false); server.start() }
    @After fun stop() { server.shutdown() }
    private fun api(residency: String): PatientExportApi {
        val source = JSONObject(resource("mobile-config.example.json"))
        val region = source.getJSONObject("regions").getJSONObject(residency)
        val awsRegion = JSONObject(resource("export-transport.json")).getJSONObject("awsRegions").getString(residency)
        region.put("awsRegion", awsRegion).put("userPoolId", "${awsRegion}_testpool")
            .put("clientId", "testclient").put("issuer", "https://example.test/testpool")
        val services = region.getJSONObject("services")
        services.keys().asSequence().toList().forEach { services.put(it, server.url("/").toString()) }
        val config = MobileConfiguration(source, residency)
        val client = NativeHttp.client(config).newBuilder()
            .sslSocketFactory(clientCertificates.sslSocketFactory(), clientCertificates.trustManager).build()
        return PatientExportApi(NativeApi(config, provider, client), contract, source.getLong("maxResponseBytes"), provider)
    }
    @Test fun regionalAuthenticatedDownloadPreservesBackendBytes() = runBlocking {
        val regions = JSONObject(resource("mobile-config.example.json")).getJSONObject("regions")
        for (region in regions.keys()) {
            server.enqueue(MockResponse().setBody(okio.Buffer().write(bytes)).setHeader("X-Export-Integrity", fixture.getString("integrity")))
            assertArrayEquals(bytes, api(region).download(owner))
            val request = server.takeRequest(2, TimeUnit.SECONDS)!!
            assertEquals("GET", request.method); assertEquals(contract.patientExport.path, request.path)
            assertEquals(region, request.getHeader("x-user-region"))
            assertEquals("Bearer test-token", request.getHeader("Authorization"))
        }
        assertEquals(regions.length() * 2, fetches)
    }
    @Test fun invalidChecksumAndNonpatientRequestsNeverReturnExportBytes() {
        val region = JSONObject(resource("mobile-config.example.json")).getJSONObject("regions").keys().next()
        val client = api(region)
        assertThrows(ApiFailure::class.java) { runBlocking { client.download(owner.copy(role = Role.DOCTOR)) } }
        assertEquals(0, fetches); assertEquals(0, server.requestCount)
        server.enqueue(MockResponse().setBody(okio.Buffer().write(bytes)).setHeader("X-Export-Integrity", "invalid"))
        assertThrows(ApiFailure::class.java) { runBlocking { client.download(owner) } }
        assertEquals(1, server.requestCount)
        sdkIdentity = owner.copy(subject = "other-patient")
        assertThrows(IllegalArgumentException::class.java) { runBlocking { client.download(owner) } }
        assertEquals(1, server.requestCount)
    }

    @Test fun sessionChangedWhileDownloadingCannotReturnBytes() {
        val region = JSONObject(resource("mobile-config.example.json")).getJSONObject("regions").keys().next()
        for (replacement in listOf(owner.copy(subject = "other-patient"), owner.copy(expiresAt = Instant.EPOCH))) {
            fetches = 0; replacementOnRecheck = replacement
            server.enqueue(MockResponse().setBody(okio.Buffer().write(bytes)).setHeader("X-Export-Integrity", fixture.getString("integrity")))
            assertThrows(ApiFailure::class.java) { runBlocking { api(region).download(owner) } }
            assertEquals(2, fetches)
        }
    }

    @Test fun cancelledInFlightDownloadNeverCompletesSuccessfully() = runBlocking {
        val region = JSONObject(resource("mobile-config.example.json")).getJSONObject("regions").keys().next()
        server.enqueue(MockResponse().setBody(okio.Buffer().write(bytes)).setBodyDelay(2, TimeUnit.SECONDS)
            .setHeader("X-Export-Integrity", fixture.getString("integrity")))
        var returned = false
        val operation = launch(start = CoroutineStart.UNDISPATCHED) { api(region).download(owner); returned = true }
        assertNotNull(server.takeRequest(2, TimeUnit.SECONDS))
        operation.cancelAndJoin()
        assertFalse(returned)
    }
}
