package com.mediconnect.nativeapp

import com.amplifyframework.auth.result.step.AuthNextSignInStep
import com.amplifyframework.auth.result.step.AuthSignInStep

/** Memory-only enrollment material. Never serialize or put the key in diagnostic output. */
class AuthenticatorSetup private constructor(private val key: String) {
    fun displayKey(): String = key
    override fun toString(): String = "AuthenticatorSetup(redacted)"
    companion object {
        fun fromSdk(step: AuthNextSignInStep): AuthenticatorSetup? {
            if (step.signInStep != AuthSignInStep.CONTINUE_SIGN_IN_WITH_TOTP_SETUP) return null
            val key = step.totpSetupDetails?.sharedSecret?.takeUnless { it.isBlank() } ?: return null
            return AuthenticatorSetup(key)
        }
    }
}
