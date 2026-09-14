package com.mediconnect.nativeapp

import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.withTimeout
import okhttp3.Call
import okhttp3.EventListener
import okhttp3.Response
import okhttp3.mockwebserver.SocketPolicy
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.tls.HandshakeCertificates
import okhttp3.tls.HeldCertificate
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
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
    private fun api(residency: String = "US", maxBytes: Int = 1048576, timeoutSeconds: Int = 10,
                    listener: EventListener = EventListener.NONE): NativeApi {
        val source = JSONObject(resource("mobile-config.example.json"))
        source.put("requestTimeoutSeconds", timeoutSeconds).put("maxResponseBytes", maxBytes)
        val region = source.getJSONObject("regions").getJSONObject(residency)
        val awsRegion = if (residency == "US") "us-east-1" else "eu-central-1"
        region.put("awsRegion", awsRegion).put("userPoolId", "${awsRegion}_testpool")
            .put("clientId", "testclient").put("issuer", "https://example.test/testpool")
        val services = region.getJSONObject("services")
        services.keys().asSequence().toList().forEach { services.put(it, server.url("/").toString()) }
        val config = MobileConfiguration(source, residency)
        val client = NativeHttp.client(config).newBuilder().eventListener(listener)
            .sslSocketFactory(clientCertificates.sslSocketFactory(), clientCertificates.trustManager).build()
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
    @Test fun responseMetadataPreservesStatusBodyAndOptionalHeader() = runBlocking {
        for (region in listOf("US", "EU")) {
            for (integrity in listOf(null, "test-unverified-integrity")) {
                val fixture = MockResponse().setResponseCode(202).setBody("{\"status\":\"REVIEW_REQUIRED\"}")
                if (integrity != null) fixture.setHeader("x-export-integrity", integrity)
                server.enqueue(fixture)
                val result = api(region).requestResponse(identity, "patient", "/me")
                assertEquals(202, result.status)
                assertEquals("REVIEW_REQUIRED", JSONObject(result.body).getString("status"))
                assertEquals(integrity, result.exportIntegrity)
            }
        }
    }
    @Test fun metadataEntryStillRejectsNonSuccessAndOversizedBodies() {
        server.enqueue(MockResponse().setResponseCode(409).setBody("{}"))
        val failure = assertThrows(ApiFailure::class.java) {
            runBlocking { api().requestResponse(identity, "patient", "/me") }
        }
        assertEquals(409, failure.status)
        server.enqueue(MockResponse().setBody("12345"))
        assertThrows(ApiFailure::class.java) {
            runBlocking { api(maxBytes = 4).requestResponse(identity, "patient", "/me") }
        }
    }

    @Test fun privacyFailuresExposeOnlyKnownStatusAndCodePairs() {
        val cases = listOf(
            Triple(409, "{\"status\":\"IN_PROGRESS\"}", NativeFailureOutcome.ERASURE_IN_PROGRESS),
            Triple(409, "{\"status\":\"REQUEST_CHANGED\"}", NativeFailureOutcome.ERASURE_REQUEST_CHANGED),
            Triple(503, "{\"status\":\"RETRY_REQUIRED\",\"code\":\"ERASURE_INCOMPLETE\"}", NativeFailureOutcome.ERASURE_RETRY_REQUIRED),
            Triple(503, "{\"code\":\"DATA_EXPORT_INCOMPLETE\"}", NativeFailureOutcome.EXPORT_INCOMPLETE),
            Triple(401, "{\"status\":\"IN_PROGRESS\"}", null),
            Triple(409, "{\"status\":true}", null),
            Triple(409, "{\"status\":\"UNKNOWN\"}", null),
            Triple(409, "{\"status\":\"IN_PROGRESS\",\"code\":\"DATA_EXPORT_INCOMPLETE\"}", null),
            Triple(503, "{\"code\":\"ERASURE_INCOMPLETE\"}", null),
            Triple(503, "{\"status\":null,\"code\":\"DATA_EXPORT_INCOMPLETE\"}", null),
            Triple(503, "not-json", null),
            Triple(409, "{\"status\":\"IN_PROGRESS\"} trailing", null),
            Triple(409, "{status:'IN_PROGRESS'}", null),
            Triple(409, "{\"status\":\"IN_PROGRESS\",}", null)
        )
        for (region in listOf("US", "EU")) for ((status, body, outcome) in cases) {
            server.enqueue(MockResponse().setResponseCode(status).setBody(body))
            val failure = assertThrows(ApiFailure::class.java) {
                runBlocking { api(region).request(identity, "patient", "/me") }
            }
            assertEquals(status, failure.status)
            assertEquals(outcome, failure.outcome)
            assertEquals("REQUEST_UNAVAILABLE", failure.message)
            assertEquals(null, failure.cause)
        }
    }
    @Test fun oversizedErrorBodiesPreserveStatusWithoutOutcome() {
        for (region in listOf("US", "EU")) for (chunked in listOf(false, true)) {
            val body = "{\"status\":\"IN_PROGRESS\"}"
            val response = MockResponse().setResponseCode(409)
            if (chunked) response.setChunkedBody(body, 2) else response.setBody(body)
            server.enqueue(response)
            val failure = assertThrows(ApiFailure::class.java) {
                runBlocking { api(region, maxBytes = 4).request(identity, "patient", "/me") }
            }
            assertEquals(409, failure.status)
            assertEquals(null, failure.outcome)
        }
    }

    private fun rejectsMalformedPrivacyBody(body: String) {
        for (region in listOf("US", "EU")) {
            server.enqueue(MockResponse().setResponseCode(409).setBody(body))
            val failure = assertThrows(ApiFailure::class.java) {
                runBlocking { api(region).request(identity, "patient", "/me") }
            }
            assertEquals(409, failure.status)
            assertEquals(null, failure.outcome)
            assertEquals("REQUEST_UNAVAILABLE", failure.message)
        }
    }

    @Test fun rejectsTrailingPrivacyInput() =
        rejectsMalformedPrivacyBody("{\"status\":\"IN_PROGRESS\"} trailing")

    @Test fun rejectsUnquotedPrivacyKeys() =
        rejectsMalformedPrivacyBody("{status:'IN_PROGRESS'}")

    @Test fun rejectsTrailingPrivacyComma() =
        rejectsMalformedPrivacyBody("{\"status\":\"IN_PROGRESS\",}")

    @Test fun rejectsDuplicatePrivacyStatus() =
        rejectsMalformedPrivacyBody("{\"status\":\"REQUEST_CHANGED\",\"status\":\"IN_PROGRESS\"}")

    @Test fun rejectsMalformedIgnoredPrivacyField() =
        rejectsMalformedPrivacyBody("{\"status\":\"IN_PROGRESS\",\"ignored\":[1,]}")

    @Test fun invalidUtf8PreservesStatusWithoutOutcome() {
        val body = okio.Buffer().writeUtf8("{\"status\":\"IN_PROGRESS\",\"ignored\":\"")
            .writeByte(0xff).writeUtf8("\"}")
        for (region in listOf("US", "EU")) {
            server.enqueue(MockResponse().setResponseCode(409).setBody(body.clone()))
            val failure = assertThrows(ApiFailure::class.java) {
                runBlocking { api(region).request(identity, "patient", "/me") }
            }
            assertEquals(409, failure.status)
            assertEquals(null, failure.outcome)
        }
    }

    @Test fun interruptedErrorBodyPreservesStatusWithoutOutcome() {
        for (region in listOf("US", "EU")) {
            server.enqueue(MockResponse().setResponseCode(409)
                .setBody("{\"status\":\"IN_PROGRESS\"}")
                .setSocketPolicy(SocketPolicy.DISCONNECT_DURING_RESPONSE_BODY))
            val failure = assertThrows(ApiFailure::class.java) {
                runBlocking { api(region).request(identity, "patient", "/me") }
            }
            assertEquals(409, failure.status)
            assertEquals(null, failure.outcome)
        }
    }

    @Test fun cancellationWhileReadingErrorBodyRemainsCancellation() = runBlocking {
        for (region in listOf("US", "EU")) {
            val headers = CompletableDeferred<Unit>()
            val listener = object : EventListener() {
                override fun responseHeadersEnd(call: Call, response: Response) { headers.complete(Unit) }
            }
            server.enqueue(MockResponse().setResponseCode(409).setBody("{\"status\":\"IN_PROGRESS\"}")
                .setBodyDelay(2, TimeUnit.SECONDS))
            val request = async { api(region, listener = listener).request(identity, "patient", "/me") }
            withTimeout(5000) { headers.await(); request.cancelAndJoin() }
            assertTrue(request.isCancelled)
        }
    }
}
