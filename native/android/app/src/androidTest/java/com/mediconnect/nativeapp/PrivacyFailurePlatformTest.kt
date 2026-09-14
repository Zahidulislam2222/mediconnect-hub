package com.mediconnect.nativeapp

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PrivacyFailurePlatformTest {
    @Test fun validOutcomeSurvivesWhitespaceAndIgnoredFields() {
        assertEquals(NativeFailureOutcome.ERASURE_IN_PROGRESS,
            NativeFailureOutcome.decode(409, " \n{\"requestId\":\"test-request\",\"status\":\"IN_PROGRESS\"}\t"))
    }

    @Test fun trailingDataIsRejected() {
        assertNull(NativeFailureOutcome.decode(409, "{\"status\":\"IN_PROGRESS\"} trailing"))
    }

    @Test fun unquotedKeysAreRejected() {
        assertNull(NativeFailureOutcome.decode(409, "{status:'IN_PROGRESS'}"))
    }

    @Test fun trailingCommaIsRejected() {
        assertNull(NativeFailureOutcome.decode(409, "{\"status\":\"IN_PROGRESS\",}"))
    }

    @Test fun escapedDuplicateKeyIsRejected() {
        assertNull(NativeFailureOutcome.decode(409,
            "{\"status\":\"REQUEST_CHANGED\",\"sta\\u0074us\":\"IN_PROGRESS\"}"))
    }

    @Test fun malformedIgnoredValueIsRejected() {
        assertNull(NativeFailureOutcome.decode(409, "{\"status\":\"IN_PROGRESS\",\"ignored\":[1,]}"))
    }
}
