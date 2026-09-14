package com.mediconnect.nativeapp

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import com.amplifyframework.auth.MFAType
import com.amplifyframework.auth.cognito.challengeResponse
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class MfaSelectionScreenTest {
    @get:Rule val compose = createComposeRule()
    private val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    private fun read(name: String) = JSONObject(assets.open(name).bufferedReader().use { it.readText() })
    private val content = MobileContent(read("mobile-content.json"))
    private val policies = MobilePolicies(read("legal.json"), read("consent.json"))
    private val state = mutableStateOf(WorkspaceState(challenge = true, challengeChoices = listOf(MFAType.TOTP, MFAType.EMAIL)))
    private fun show(confirm: (String) -> Unit = {}, cancel: () -> Unit = {}) {
        compose.setContent { MobileTheme(content) {
            WorkspaceScreen(state.value, content, true, "US", { _, _ -> }, confirm, cancel, {},
                RecoveryState(), {}, {}, { _, _ -> }, {}, policies, RegistrationState(), {}, {}, { _, _, _ -> }, {}, {}, {})
        } }
    }
    @Test fun onlyAllowedChoicesAreVisibleAndSelectionAdvancesToCode() {
        var selected: String? = null
        show(confirm = { selected = it; state.value = WorkspaceState(challenge = true) })
        compose.onNodeWithText(content.text("mfaSms")).assertDoesNotExist()
        compose.onNodeWithText(content.text("mfaAuthenticator")).performScrollTo().performClick()
        assertEquals(MFAType.TOTP.challengeResponse, selected)
        compose.onNodeWithText(content.text("code")).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText(content.text("mfaAuthenticator")).assertDoesNotExist()
    }
    @Test fun busyStateDisablesChoices() {
        state.value = state.value.copy(busy = true); show()
        compose.onNodeWithText(content.text("mfaAuthenticator")).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText(content.text("mfaEmail")).performScrollTo().assertIsNotEnabled()
    }
    @Test fun cancellationRemovesChoicesAndReturnsToSignIn() {
        show(cancel = { state.value = WorkspaceState() })
        compose.onNodeWithText(content.text("cancel")).performScrollTo().performClick()
        compose.onNodeWithText(content.text("chooseMfa")).assertDoesNotExist()
        compose.onNodeWithText(content.text("signIn")).performScrollTo().assertIsDisplayed()
    }
}
