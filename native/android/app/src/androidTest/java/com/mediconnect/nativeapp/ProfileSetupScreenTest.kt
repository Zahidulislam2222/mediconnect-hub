package com.mediconnect.nativeapp

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import java.time.Instant

class ProfileSetupScreenTest {
    @get:Rule val compose = createComposeRule()
    private val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    private fun read(name: String) = JSONObject(assets.open(name).bufferedReader().use { it.readText() })
    private val content = MobileContent(read("mobile-content.json"))
    private val policies = MobilePolicies(read("legal.json"), read("consent.json"))
    private var creates = 0
    private var fail = false
    private fun show() {
        compose.setContent {
            val scope = rememberCoroutineScope()
            val model = remember {
                val identity = Identity("test-patient", Role.PATIENT, Instant.now().plusSeconds(300))
                ProfileEnrollment(object : ProfileService {
                    override suspend fun load(identity: Identity): OwnProfile {
                        if (creates == 0 || fail) throw ApiFailure(404)
                        return OwnProfile(identity.subject, "Test person", "test-user@example.test")
                    }
                    override suspend fun create(identity: Identity, details: ProfileDetails, policyVersion: String) {
                        creates++; if (fail) throw ApiFailure()
                    }
                }, policies.policyVersion, scope).also { it.open(identity) }
            }
            val state by model.state.collectAsState()
            MobileTheme(content) { Column(Modifier.verticalScroll(rememberScrollState())) {
                if (state.step == ProfileStep.READY) Text(content.text("appointments"))
                else ProfileSetup(state, Role.PATIENT, content, policies, model::accept, model::submit, model::check)
            } }
        }
    }
    private fun fillAndSubmit() {
        compose.onNodeWithText(content.text("fullName")).performScrollTo().performTextInput("Test person")
        compose.onNodeWithText(content.text("email")).performScrollTo().performTextInput("test-user@example.test")
        compose.onNodeWithText(content.text("saveProfile")).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithContentDescription(policies.acceptance).performScrollTo().assertIsOff().performClick()
        compose.onNodeWithText(content.text("saveProfile")).performScrollTo().performClick()
    }
    @Test fun profileSetupRequiresExplicitConsentAndReadsBack() {
        show(); fillAndSubmit()
        compose.onNodeWithText(content.text("appointments")).assertIsDisplayed(); assertEquals(1, creates)
    }
    @Test fun uncertainSaveRequiresStatusCheckAndFreshConsent() {
        fail = true; show(); fillAndSubmit()
        compose.onNodeWithText(content.text("profileCheckFailed")).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText(content.text("checkProfile")).performScrollTo().performClick()
        compose.onNodeWithContentDescription(policies.acceptance).performScrollTo().assertIsOff()
        compose.onNodeWithText(content.text("saveProfile")).performScrollTo().assertIsNotEnabled(); assertEquals(1, creates)
    }
}
