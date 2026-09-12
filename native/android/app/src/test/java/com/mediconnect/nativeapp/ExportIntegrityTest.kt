package com.mediconnect.nativeapp

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.security.MessageDigest

class ExportIntegrityTest {
    private fun digest(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes)
        .joinToString("") { "%02x".format(it) }

    @Test fun knownDigestAndUppercaseAreAccepted() {
        val bytes = "abc".toByteArray()
        val known = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        for (header in listOf(known, known.uppercase())) {
            assertArrayEquals(bytes, ExportIntegrity.verifiedBytes(NativeResponse(bytes, 200, header)))
        }
    }

    @Test fun bytesArePreservedWithoutJsonOrUnicodeNormalization() {
        for (bytes in listOf("{ \"text\": \"é বাংলা\" }\n".toByteArray(), byteArrayOf(0xc3.toByte(), 0x28))) {
            assertArrayEquals(bytes, ExportIntegrity.verifiedBytes(NativeResponse(bytes, 200, digest(bytes))))
        }
        val original = "{\"x\":1}".toByteArray()
        assertThrows(ApiFailure::class.java) {
            ExportIntegrity.verifiedBytes(NativeResponse("{ \"x\": 1 }".toByteArray(), 200, digest(original)))
        }
    }

    @Test fun missingMalformedOrTamperedDigestIsRejected() {
        val bytes = "abc".toByteArray()
        val hash = digest(bytes)
        for (header in listOf(null, "", " $hash", "$hash ", "$hash,$hash", hash.drop(1), "g".repeat(64), "０".repeat(64), "0".repeat(64))) {
            assertThrows(ApiFailure::class.java) { ExportIntegrity.verifiedBytes(NativeResponse(bytes, 200, header)) }
        }
        for (status in listOf(201, 204, 206, 400, 503)) {
            assertThrows(ApiFailure::class.java) { ExportIntegrity.verifiedBytes(NativeResponse(bytes, status, hash)) }
        }
        assertThrows(ApiFailure::class.java) {
            ExportIntegrity.verifiedBytes(NativeResponse(byteArrayOf(), 200, digest(byteArrayOf())))
        }
    }

    @Test fun callerCannotMutateRetainedResponseBytes() {
        val input = "abc".toByteArray()
        val response = NativeResponse(input, 200, digest(input))
        input[0] = 0
        response.bytes[1] = 0
        val verified = ExportIntegrity.verifiedBytes(response)
        verified[2] = 0
        assertEquals("abc", response.body)
        assertArrayEquals("abc".toByteArray(), ExportIntegrity.verifiedBytes(response))
    }
}
