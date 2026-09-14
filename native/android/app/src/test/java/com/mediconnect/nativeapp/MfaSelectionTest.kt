package com.mediconnect.nativeapp

import com.amplifyframework.auth.MFAType
import com.amplifyframework.auth.cognito.challengeResponse
import com.amplifyframework.auth.result.step.AuthNextSignInStep
import com.amplifyframework.auth.result.step.AuthSignInStep
import org.junit.Assert.*
import org.junit.Test

class MfaSelectionTest {
    private fun next(step: AuthSignInStep, allowed: Set<MFAType>?) =
        AuthNextSignInStep(step, emptyMap(), null, null, allowed, null)

    @Test fun sdkSelectionsUseOnlyAllowedMethodsInStableOrder() {
        for (step in listOf(AuthSignInStep.CONTINUE_SIGN_IN_WITH_MFA_SELECTION, AuthSignInStep.CONTINUE_SIGN_IN_WITH_MFA_SETUP_SELECTION)) {
            assertEquals(listOf(MFAType.TOTP, MFAType.SMS, MFAType.EMAIL),
                SignInChallenge.choices(next(step, setOf(MFAType.EMAIL, MFAType.SMS, MFAType.TOTP))))
            assertEquals(listOf(MFAType.EMAIL), SignInChallenge.choices(next(step, setOf(MFAType.EMAIL))))
            assertTrue(SignInChallenge.choices(next(step, null)).isEmpty())
            assertTrue(SignInChallenge.choices(next(step, emptySet())).isEmpty())
        }
    }
    @Test fun unrelatedChallengesDoNotAcceptInjectedChoices() {
        for (step in AuthSignInStep.entries.filter { it != AuthSignInStep.CONTINUE_SIGN_IN_WITH_MFA_SELECTION && it != AuthSignInStep.CONTINUE_SIGN_IN_WITH_MFA_SETUP_SELECTION }) {
            assertTrue(SignInChallenge.choices(next(step, MFAType.entries.toSet())).isEmpty())
        }
    }
    @Test fun selectionRequiresExactAllowedSdkResponse() {
        val choices = listOf(MFAType.TOTP)
        assertEquals(MFAType.TOTP.challengeResponse, SignInChallenge.selectionResponse(choices, MFAType.TOTP.challengeResponse))
        for (value in listOf("", "123456", MFAType.SMS.challengeResponse, " ${MFAType.TOTP.challengeResponse} ")) {
            assertNull(SignInChallenge.selectionResponse(choices, value))
        }
        assertNull(SignInChallenge.selectionResponse(emptyList(), MFAType.TOTP.challengeResponse))
    }
}
