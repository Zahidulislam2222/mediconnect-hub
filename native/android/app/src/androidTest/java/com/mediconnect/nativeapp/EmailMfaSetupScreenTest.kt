package com.mediconnect.nativeapp

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class EmailMfaSetupScreenTest {
    @get:Rule val compose = createComposeRule()
    private val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    private fun read(name: String) = JSONObject(assets.open(name).bufferedReader().use { it.readText() })
    private val content = MobileContent(read("mobile-content.json"))
    private val policies = MobilePolicies(read("legal.json"), read("consent.json"))
    private val state = mutableStateOf(WorkspaceState(challenge = true, challengeInput = ChallengeInput.EMAIL))
    private fun show(confirm: (String) -> Unit = {}, cancel: () -> Unit = {}) {
        compose.setContent { MobileTheme(content) {
            WorkspaceScreen(state.value, content, true, "US", { _, _ -> }, confirm, cancel, {},
                RecoveryState(), {}, {}, { _, _ -> }, {}, policies, RegistrationState(), {}, {}, { _, _, _ -> }, {}, {}, {})
        } }
    }
    @Test fun emailSubmissionAdvancesToEmptySecureCodeInput() {
        var selected: String? = null
        show(confirm = { selected = SignInChallenge.response(ChallengeInput.EMAIL, it); state.value = WorkspaceState(challenge = true) })
        compose.onNodeWithText(content.text("verify")).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText(content.text("mfaEmailAddress")).performScrollTo().performTextInput(" test-user@example.invalid ")
        compose.onNodeWithText(content.text("verify")).performScrollTo().performClick()
        assertEquals("test-user@example.invalid", selected)
        compose.onNodeWithText(content.text("mfaEmailAddress")).assertDoesNotExist()
        compose.onNodeWithText(content.text("code")).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText(content.text("verify")).performScrollTo().assertIsNotEnabled()
    }
    @Test fun busyStateDisablesEmailAndSubmit() {
        state.value = state.value.copy(busy = true); show()
        compose.onNodeWithText(content.text("mfaEmailAddress")).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText(content.text("verify")).performScrollTo().assertIsNotEnabled()
    }
    @Test fun cancellationClearsEmailSetup() {
        show(cancel = { state.value = WorkspaceState() })
        compose.onNodeWithText(content.text("mfaEmailAddress")).performScrollTo().performTextInput("test-user@example.invalid")
        compose.onNodeWithText(content.text("cancel")).performScrollTo().performClick()
        compose.onNodeWithText(content.text("mfaEmailAddress")).assertDoesNotExist()
        compose.onNodeWithText(content.text("signIn")).performScrollTo().assertIsDisplayed()
    }
}
