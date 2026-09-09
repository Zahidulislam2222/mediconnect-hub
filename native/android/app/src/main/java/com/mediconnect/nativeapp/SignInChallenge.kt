package com.mediconnect.nativeapp

import com.amplifyframework.auth.result.step.AuthSignInStep

enum class ChallengeInput { CODE, PASSWORD, NEW_PASSWORD }

object SignInChallenge {
    fun input(step: AuthSignInStep): ChallengeInput? = when {
        needsCode(step) -> ChallengeInput.CODE
        step == AuthSignInStep.CONFIRM_SIGN_IN_WITH_PASSWORD -> ChallengeInput.PASSWORD
        step == AuthSignInStep.CONFIRM_SIGN_IN_WITH_NEW_PASSWORD -> ChallengeInput.NEW_PASSWORD
        else -> null
    }
    fun response(input: ChallengeInput, value: String): String? =
        if (value.isBlank()) null else if (input == ChallengeInput.CODE) value.trim() else value

    fun needsCode(step: AuthSignInStep): Boolean = when (step) {
        AuthSignInStep.CONFIRM_SIGN_IN_WITH_SMS_MFA_CODE,
        AuthSignInStep.CONFIRM_SIGN_IN_WITH_TOTP_CODE,
        AuthSignInStep.CONFIRM_SIGN_IN_WITH_OTP -> true
        else -> false
    }
}
