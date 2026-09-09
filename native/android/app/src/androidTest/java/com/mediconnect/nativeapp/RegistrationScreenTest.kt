package com.mediconnect.nativeapp

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class RegistrationScreenTest {
    @get:Rule val compose = createComposeRule()
    private val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    private fun read(name: String) = JSONObject(assets.open(name).bufferedReader().use { it.readText() })
    private val content = MobileContent(read("mobile-content.json"))
    private val policies = MobilePolicies(read("legal.json"), read("consent.json"))
    private var requests = 0; private var confirmations = 0; private var resends = 0
    private lateinit var model: AccountRegistration
    private fun show() {
        compose.setContent {
            val scope = rememberCoroutineScope()
            val registration = androidx.compose.runtime.remember {
                AccountRegistration(object : RegistrationService {
                    override suspend fun register(username: String, password: String, name: String): Boolean { requests++; return false }
                    override suspend fun confirmRegistration(username: String, code: String): Boolean { confirmations++; return true }
                    override suspend fun resendRegistration(username: String) { resends++ }
                }, scope).also { model = it; it.open() }
            }
            val state by registration.state.collectAsState()
            MobileTheme(content) { Column(Modifier.verticalScroll(rememberScrollState())) {
                if (state.step != RegistrationStep.CLOSED) RegistrationForm(state, content, policies, registration::accept,
                    registration::register, registration::confirm, registration::resend, registration::close)
            } }
        }
    }
    @Test fun explicitConsentThenRegisterResendConfirm() {
        show()
        compose.onNodeWithText(content.text("register")).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithContentDescription(policies.acceptance).performScrollTo().assertIsOff()
        compose.onNodeWithText(content.text("fullName")).performScrollTo().performTextInput("Test person")
        compose.onNodeWithText(content.text("email")).performScrollTo().performTextInput("test-user@example.test")
        compose.onNodeWithText(content.text("password")).performScrollTo().performTextInput("test-password")
        compose.onNodeWithText(content.text("register")).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithContentDescription(policies.acceptance).performScrollTo().performClick()
        compose.onNodeWithText(content.text("register")).performScrollTo().performClick()
        compose.onNodeWithText(content.text("resendCode")).performScrollTo().performClick()
        compose.onNodeWithText(content.text("code")).performScrollTo().performTextInput("123456")
        compose.onNodeWithText(content.text("verify")).performScrollTo().performClick()
        compose.onNodeWithText(content.text("registrationComplete")).performScrollTo().assertIsDisplayed()
        assertEquals(1, requests); assertEquals(1, resends); assertEquals(1, confirmations)
    }
    @Test fun closingAndReopeningClearsFieldsAndConsent() {
        show(); compose.onNodeWithText(content.text("password")).performTextInput("test-password")
        compose.onNodeWithContentDescription(policies.acceptance).performScrollTo().performClick()
        compose.onNodeWithText(content.text("backToSignIn")).performScrollTo().performClick()
        compose.runOnIdle { model.open() }
        compose.onNodeWithContentDescription(policies.acceptance).performScrollTo().assertIsOff()
        compose.onNodeWithText(content.text("register")).performScrollTo().assertIsNotEnabled()
        assertEquals(0, requests)
    }
    @Test fun policyTextIsReadableBeforeConsent() {
        show(); val page = policies.pages.getValue("terms")
        compose.onNodeWithText(page.title).performScrollTo().performClick()
        compose.onNodeWithText(page.sections.first().body).assertIsDisplayed()
        compose.onNodeWithText(content.text("close")).performClick()
        compose.onNodeWithContentDescription(policies.acceptance).performScrollTo().assertIsOff()
        assertEquals(0, requests)
    }
}
