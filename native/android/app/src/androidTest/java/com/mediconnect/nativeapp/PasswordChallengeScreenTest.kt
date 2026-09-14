package com.mediconnect.nativeapp

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class PasswordChallengeScreenTest {
    @get:Rule val compose = createComposeRule()
    private val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    private fun read(name: String) = JSONObject(assets.open(name).bufferedReader().use { it.readText() })
    private val content = MobileContent(read("mobile-content.json"))
    private val policies = MobilePolicies(read("legal.json"), read("consent.json"))
    private fun show(input: ChallengeInput, confirm: (String) -> Unit) {
        compose.setContent { MobileTheme(content) {
            WorkspaceScreen(WorkspaceState(challenge = true, challengeInput = input), content, true, "US",
                { _, _ -> }, confirm, {}, {}, RecoveryState(), {}, {}, { _, _ -> }, {}, policies,
                RegistrationState(), {}, {}, { _, _, _ -> }, {}, {}, {})
        } }
    }
    @Test fun newPasswordIsSecureAndSubmittedExactlyThenCleared() {
        var received: String? = null
        show(ChallengeInput.NEW_PASSWORD) { received = it }
        val field = compose.onNodeWithText(content.text("newPassword"))
        field.performScrollTo().assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Password))
        field.performTextInput(" test-password ")
        compose.onNodeWithText(content.text("verify")).performScrollTo().performClick()
        assertTrue(received == " test-password ")
        compose.onNodeWithText(content.text("verify")).assertIsNotEnabled()
    }
    @Test fun existingPasswordUsesSecurePasswordField() {
        show(ChallengeInput.PASSWORD) {}
        compose.onNodeWithText(content.text("password")).performScrollTo()
            .assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Password))
        compose.onNodeWithText(content.text("verify")).performScrollTo().assertIsNotEnabled()
    }
}
