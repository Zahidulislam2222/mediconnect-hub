package com.mediconnect.nativeapp

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class PasswordRecoveryScreenTest {
    @get:Rule val compose = createComposeRule()
    private val content = MobileContent(JSONObject(InstrumentationRegistry.getInstrumentation().targetContext.assets
        .open("mobile-content.json").bufferedReader().use { it.readText() }))

    @Test fun requestButtonRequiresInputAndSubmitsOnce() {
        var submitted: String? = null
        val state = mutableStateOf(RecoveryState(RecoveryStep.REQUEST))
        compose.setContent { MobileTheme(content) { RecoveryForm(state.value, content,
            { submitted = it; state.value = RecoveryState(RecoveryStep.REQUEST, busy = true) }, { _, _ -> }, {}) } }
        compose.onNodeWithText(content.text("sendResetCode")).assertIsNotEnabled()
        compose.onNodeWithText(content.text("email")).performTextInput("test-user@example.test")
        compose.onNodeWithText(content.text("sendResetCode")).performClick()
        compose.onNodeWithText(content.text("sendResetCode")).assertIsNotEnabled()
        assertEquals("test-user@example.test", submitted)
    }
    @Test fun cancellationAndReopeningClearSensitiveFields() {
        val state = mutableStateOf(RecoveryState(RecoveryStep.CONFIRM))
        compose.setContent { MobileTheme(content) {
            if (state.value.step != RecoveryStep.CLOSED) RecoveryForm(state.value, content, {}, { _, _ -> },
                { state.value = RecoveryState() })
        } }
        compose.onNodeWithText(content.text("code")).performTextInput("123456")
        compose.onNodeWithText(content.text("newPassword")).performTextInput("test-password")
        compose.onNodeWithText(content.text("backToSignIn")).performClick()
        compose.onNodeWithText(content.text("resetPassword")).assertDoesNotExist()
        compose.runOnIdle { state.value = RecoveryState(RecoveryStep.CONFIRM) }
        compose.onNodeWithText(content.text("resetPassword")).assertIsNotEnabled()
    }
    @Test fun completionRequiresAnExplicitReturnToSignIn() {
        compose.setContent { MobileTheme(content) { RecoveryForm(RecoveryState(RecoveryStep.COMPLETE), content, {}, { _, _ -> }, {}) } }
        compose.onNodeWithText(content.text("recoveryComplete")).assertIsDisplayed()
        compose.onNodeWithText(content.text("backToSignIn")).assertIsDisplayed()
        compose.onNodeWithText(content.text("newPassword")).assertDoesNotExist()
    }
}
