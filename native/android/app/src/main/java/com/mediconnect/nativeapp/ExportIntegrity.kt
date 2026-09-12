package com.mediconnect.nativeapp

import java.security.MessageDigest

/** Verifies the backend's wire checksum; does not validate FHIR, ownership or authenticity. */
object ExportIntegrity {
    private const val DIGEST_ALGORITHM = "SHA-256"
    private const val DIGEST_HEX_LENGTH = 64

    fun verifiedBytes(response: NativeResponse): ByteArray {
        val bytes = response.bytes
        val header = response.exportIntegrity
        if (response.status != 200 || bytes.isEmpty() || header == null ||
            header.length != DIGEST_HEX_LENGTH || !header.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) {
            throw ApiFailure()
        }
        val expected = ByteArray(DIGEST_HEX_LENGTH / 2) { index ->
            header.substring(index * 2, index * 2 + 2).toInt(16).toByte()
        }
        val actual = MessageDigest.getInstance(DIGEST_ALGORITHM).digest(bytes)
        if (!MessageDigest.isEqual(expected, actual)) throw ApiFailure()
        return bytes
    }
}
