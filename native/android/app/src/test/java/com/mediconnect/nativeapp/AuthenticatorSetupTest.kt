package com.mediconnect.nativeapp

import com.amplifyframework.auth.TOTPSetupDetails
import com.amplifyframework.auth.result.step.AuthNextSignInStep
import com.amplifyframework.auth.result.step.AuthSignInStep
import org.junit.Assert.*
import org.junit.Test

class AuthenticatorSetupTest {
    private fun next(step: AuthSignInStep = AuthSignInStep.CONTINUE_SIGN_IN_WITH_TOTP_SETUP, key: String? = "test-key") =
        AuthNextSignInStep(step, emptyMap(), null, key?.let { TOTPSetupDetails(it, "test-user") }, null, null)
    @Test fun matchingSdkDetailsAreRequired() {
        assertEquals("test-key", AuthenticatorSetup.fromSdk(next())?.displayKey())
        assertNull(AuthenticatorSetup.fromSdk(next(key = null)))
        assertNull(AuthenticatorSetup.fromSdk(next(key = " \n ")))
        for (step in AuthSignInStep.entries.filter { it != AuthSignInStep.CONTINUE_SIGN_IN_WITH_TOTP_SETUP }) {
            assertNull(AuthenticatorSetup.fromSdk(next(step)))
        }
    }
    @Test fun diagnosticsRedactTheKeyIncludingContainingState() {
        val setup = AuthenticatorSetup.fromSdk(next())!!
        assertFalse(setup.toString().contains("test-key"))
        assertFalse(WorkspaceState(authenticatorSetup = setup).toString().contains("test-key"))
    }
    @Test fun onlyIdleUnauthenticatedEnrollmentSurvivesAppSwitching() {
        val setup = AuthenticatorSetup.fromSdk(next())!!
        assertTrue(SignInChallenge.retainForAuthenticator(true, ChallengeInput.TOTP_SETUP, setup, false, false))
        assertFalse(SignInChallenge.retainForAuthenticator(false, ChallengeInput.TOTP_SETUP, setup, false, false))
        assertFalse(SignInChallenge.retainForAuthenticator(true, ChallengeInput.TOTP_SETUP, null, false, false))
        assertFalse(SignInChallenge.retainForAuthenticator(true, ChallengeInput.TOTP_SETUP, setup, true, false))
        assertFalse(SignInChallenge.retainForAuthenticator(true, ChallengeInput.TOTP_SETUP, setup, false, true))
        for (input in ChallengeInput.entries.filter { it != ChallengeInput.TOTP_SETUP }) {
            assertFalse(SignInChallenge.retainForAuthenticator(true, input, setup, false, false))
        }
    }
    @Test fun enrollmentCodesAreTrimmedAndBlankValuesRejected() {
        assertEquals("123456", SignInChallenge.response(ChallengeInput.TOTP_SETUP, " 123456 \n"))
        assertNull(SignInChallenge.response(ChallengeInput.TOTP_SETUP, " \n "))
    }
}
