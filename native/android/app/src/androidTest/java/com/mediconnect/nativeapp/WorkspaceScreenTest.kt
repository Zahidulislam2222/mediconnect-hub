package com.mediconnect.nativeapp

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test
import java.time.Instant

class WorkspaceScreenTest {
    @get:Rule val compose = createComposeRule()
    private val content = MobileContent(JSONObject(InstrumentationRegistry.getInstrumentation().targetContext.assets
        .open("mobile-content.json").bufferedReader().use { it.readText() }))
    private val policies = InstrumentationRegistry.getInstrumentation().targetContext.assets.let { assets ->
        MobilePolicies(JSONObject(assets.open("legal.json").bufferedReader().use { it.readText() }),
            JSONObject(assets.open("consent.json").bufferedReader().use { it.readText() }))
    }
    private fun show(state: WorkspaceState, configured: Boolean = true) {
        compose.setContent { MobileTheme(content) { WorkspaceScreen(state, content, configured, "US", { _, _ -> }, {}, {}, {},
            RecoveryState(), {}, {}, { _, _ -> }, {}, policies, RegistrationState(), {}, {}, { _, _, _ -> }, {}, {}, {}) } }
    }
    @Test fun unconfiguredAppDoesNotOfferSignIn() {
        show(WorkspaceState(), false)
        compose.onNodeWithText(content.text("configurationUnavailable")).assertIsDisplayed()
        compose.onNodeWithText(content.text("signIn")).assertDoesNotExist()
    }
    @Test fun failedRequestDoesNotClaimEmptyAppointments() {
        show(WorkspaceState(identity = Identity("test-patient", Role.PATIENT, Instant.MAX), error = "unavailable"))
        compose.onNodeWithText(content.text("unavailable")).assertIsDisplayed()
        compose.onNodeWithText(content.text("emptyAppointments")).assertDoesNotExist()
    }
    @Test fun backgroundHidesAppointmentData() {
        show(WorkspaceState(identity = Identity("test-patient", Role.PATIENT, Instant.MAX), visible = false,
            appointments = listOf(Appointment("test-appointment", null, "Test private person", null))))
        compose.onNodeWithText("Test private person").assertDoesNotExist()
    }
    @Test fun staffDoesNotReceivePatientWorkspace() {
        show(WorkspaceState(identity = Identity("test-staff", Role.STAFF, Instant.MAX)))
        compose.onNodeWithText(content.text("roleUnavailable")).assertIsDisplayed()
        compose.onNodeWithText(content.text("appointments")).assertDoesNotExist()
    }
}
