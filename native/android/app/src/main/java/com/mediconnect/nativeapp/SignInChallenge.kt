package com.mediconnect.nativeapp

import com.amplifyframework.auth.result.step.AuthSignInStep

object SignInChallenge {
    fun needsCode(step: AuthSignInStep): Boolean = when (step) {
        AuthSignInStep.CONFIRM_SIGN_IN_WITH_SMS_MFA_CODE,
        AuthSignInStep.CONFIRM_SIGN_IN_WITH_TOTP_CODE,
        AuthSignInStep.CONFIRM_SIGN_IN_WITH_OTP -> true
        else -> false
    }
}
