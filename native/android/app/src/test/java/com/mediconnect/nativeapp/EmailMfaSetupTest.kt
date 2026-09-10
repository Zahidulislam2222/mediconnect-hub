package com.mediconnect.nativeapp

import com.amplifyframework.auth.result.step.AuthSignInStep
import org.junit.Assert.*
import org.junit.Test

class EmailMfaSetupTest {
    @Test fun emailSetupAndSubsequentOtpAreDistinctInputs() {
        assertEquals(ChallengeInput.EMAIL, SignInChallenge.input(AuthSignInStep.CONTINUE_SIGN_IN_WITH_EMAIL_MFA_SETUP))
        assertEquals(ChallengeInput.CODE, SignInChallenge.input(AuthSignInStep.CONFIRM_SIGN_IN_WITH_OTP))
        assertNull(SignInChallenge.input(AuthSignInStep.DONE))
    }
    @Test fun emailIsTrimmedAndBlankResponsesAreRejected() {
        assertEquals("test-user@example.invalid", SignInChallenge.response(ChallengeInput.EMAIL, " test-user@example.invalid \n"))
        assertNull(SignInChallenge.response(ChallengeInput.EMAIL, " \n "))
        assertNull(SignInChallenge.response(ChallengeInput.EMAIL, ""))
    }
    @Test fun addingEmailDoesNotChangeExactPasswordHandling() {
        for (input in listOf(ChallengeInput.PASSWORD, ChallengeInput.NEW_PASSWORD)) {
            assertTrue(SignInChallenge.response(input, " test-password ") == " test-password ")
        }
    }
}
