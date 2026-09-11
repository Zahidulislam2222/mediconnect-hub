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

class NativeMethodsTransportTest {
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
    private fun api(residency: String = "US", maxBytes: Int = 1048576, timeoutSeconds: Int = 10): NativeApi {
        val source = JSONObject(resource("mobile-config.example.json"))
        source.put("requestTimeoutSeconds", timeoutSeconds).put("maxResponseBytes", maxBytes)
        val region = source.getJSONObject("regions").getJSONObject(residency)
        val awsRegion = if (residency == "US") "us-east-1" else "eu-central-1"
        region.put("awsRegion", awsRegion).put("userPoolId", "${awsRegion}_testpool")
            .put("clientId", "testclient").put("issuer", "https://example.test/testpool")
        val services = region.getJSONObject("services")
        services.keys().asSequence().toList().forEach { services.put(it, server.url("/").toString()) }
        val config = MobileConfiguration(source, residency)
        val client = NativeHttp.client(config).newBuilder().sslSocketFactory(clientCertificates.sslSocketFactory(), clientCertificates.trustManager).build()
        return NativeApi(config, provider, client)
    }
    @Test fun explicitMethodsPreserveBodyAndHeadersInBothRegions() = runBlocking {
        for (region in listOf("US", "EU")) {
            for (method in NativeHttpMethod.values()) {
                val body = if (method == NativeHttpMethod.GET) null else JSONObject().put("name", "Test person")
                server.enqueue(MockResponse().setBody("{}"))
                api(region).request(identity, "patient", "/me", body = body, method = method)
                val sent = server.takeRequest(2, TimeUnit.SECONDS)!!
                assertEquals(method.name, sent.method)
                assertEquals(region, sent.getHeader("x-user-region"))
                assertEquals("Bearer test-token", sent.getHeader("Authorization"))
                assertEquals("no-store", sent.getHeader("Cache-Control"))
                assertEquals(body?.toString() ?: "", sent.body.readUtf8())
            }
        }
    }
    @Test fun deleteWithoutBodyIsSentAsDelete() = runBlocking {
        server.enqueue(MockResponse().setBody("{}"))
        api().request(identity, "patient", "/me", method = NativeHttpMethod.DELETE)
        val sent = server.takeRequest(2, TimeUnit.SECONDS)!!
        assertEquals("DELETE", sent.method)
        assertEquals(0L, sent.bodySize)
    }
    @Test fun invalidBodyCombinationsNeverFetchCredentialsOrSend() {
        for ((method, body) in listOf(NativeHttpMethod.GET to JSONObject(), NativeHttpMethod.POST to null, NativeHttpMethod.PUT to null)) {
            assertThrows(IllegalArgumentException::class.java) {
                runBlocking { api().request(identity, "patient", "/me", body = body, method = method) }
            }
        }
        assertEquals(0, fetchCount)
        assertEquals(0, server.requestCount)
    }
}
