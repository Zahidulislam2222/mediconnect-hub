package com.mediconnect.nativeapp

import com.amplifyframework.auth.result.step.AuthSignInStep
import org.junit.Assert.*
import org.junit.Test

class PasswordChallengeTest {
    @Test fun mapsOnlySupportedSdkChallenges() {
        assertEquals(ChallengeInput.PASSWORD, SignInChallenge.input(AuthSignInStep.CONFIRM_SIGN_IN_WITH_PASSWORD))
        assertEquals(ChallengeInput.NEW_PASSWORD, SignInChallenge.input(AuthSignInStep.CONFIRM_SIGN_IN_WITH_NEW_PASSWORD))
        assertEquals(ChallengeInput.CODE, SignInChallenge.input(AuthSignInStep.CONFIRM_SIGN_IN_WITH_TOTP_CODE))
        assertNull(SignInChallenge.input(AuthSignInStep.CONTINUE_SIGN_IN_WITH_TOTP_SETUP))
        assertNull(SignInChallenge.input(AuthSignInStep.CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE))
        assertNull(SignInChallenge.input(AuthSignInStep.DONE))
    }
    @Test fun preservesExactPasswordsAndNormalizesCodesOnly() {
        for (input in listOf(ChallengeInput.PASSWORD, ChallengeInput.NEW_PASSWORD))
            assertTrue(SignInChallenge.response(input, " test-password ") == " test-password ")
        assertEquals("123456", SignInChallenge.response(ChallengeInput.CODE, " 123456 "))
    }
    @Test fun blankResponsesNeverSubmit() {
        for (input in ChallengeInput.entries) {
            assertNull(SignInChallenge.response(input, "")); assertNull(SignInChallenge.response(input, " \n "))
        }
    }
}
