package com.mediconnect.nativeapp

import com.amplifyframework.auth.result.step.AuthSignInStep
import com.amplifyframework.auth.result.step.AuthNextSignInStep
import com.amplifyframework.auth.MFAType
import com.amplifyframework.auth.cognito.challengeResponse

enum class ChallengeInput { CODE, PASSWORD, NEW_PASSWORD, EMAIL, TOTP_SETUP }

object SignInChallenge {
    fun choices(step: AuthNextSignInStep): List<MFAType> = when (step.signInStep) {
        AuthSignInStep.CONTINUE_SIGN_IN_WITH_MFA_SELECTION,
        AuthSignInStep.CONTINUE_SIGN_IN_WITH_MFA_SETUP_SELECTION ->
            listOf(MFAType.TOTP, MFAType.SMS, MFAType.EMAIL).filter { step.allowedMFATypes?.contains(it) == true }
        else -> emptyList()
    }
    fun selectionResponse(choices: List<MFAType>, value: String): String? =
        choices.firstOrNull { it.challengeResponse == value }?.challengeResponse
    fun label(choice: MFAType): String = when (choice) {
        MFAType.TOTP -> "mfaAuthenticator"
        MFAType.SMS -> "mfaSms"
        MFAType.EMAIL -> "mfaEmail"
    }
    fun input(step: AuthSignInStep): ChallengeInput? = when {
        needsCode(step) -> ChallengeInput.CODE
        step == AuthSignInStep.CONFIRM_SIGN_IN_WITH_PASSWORD -> ChallengeInput.PASSWORD
        step == AuthSignInStep.CONFIRM_SIGN_IN_WITH_NEW_PASSWORD -> ChallengeInput.NEW_PASSWORD
        step == AuthSignInStep.CONTINUE_SIGN_IN_WITH_EMAIL_MFA_SETUP -> ChallengeInput.EMAIL
        step == AuthSignInStep.CONTINUE_SIGN_IN_WITH_TOTP_SETUP -> ChallengeInput.TOTP_SETUP
        else -> null
    }
    fun response(input: ChallengeInput, value: String): String? =
        if (value.isBlank()) null else if (input == ChallengeInput.PASSWORD || input == ChallengeInput.NEW_PASSWORD) value else value.trim()

    fun retainForAuthenticator(challenge: Boolean, input: ChallengeInput, setup: AuthenticatorSetup?, busy: Boolean, authenticated: Boolean): Boolean =
        challenge && input == ChallengeInput.TOTP_SETUP && setup != null && !busy && !authenticated

    fun needsCode(step: AuthSignInStep): Boolean = when (step) {
        AuthSignInStep.CONFIRM_SIGN_IN_WITH_SMS_MFA_CODE,
        AuthSignInStep.CONFIRM_SIGN_IN_WITH_TOTP_CODE,
        AuthSignInStep.CONFIRM_SIGN_IN_WITH_OTP -> true
        else -> false
    }
}
