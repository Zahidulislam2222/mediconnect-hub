package com.mediconnect.nativeapp

import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import java.time.Instant

class AppointmentCancellationScreenTest {
    @get:Rule val compose = createComposeRule()
    private val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    private fun read(name: String) = JSONObject(assets.open(name).bufferedReader().use { it.readText() })
    private val content = MobileContent(read("mobile-content.json"))
    private val contract = MobileContract(read("mobile-contract.json"), read("session-policy.json"))
    private var posts = 0
    private var uncertain = false
    private fun show() {
        compose.setContent {
            val scope = rememberCoroutineScope()
            val identity = remember { Identity("test-patient", Role.PATIENT, Instant.now().plusSeconds(300)) }
            val appointment = remember { Appointment("test-appointment", null, "Test doctor", "CONFIRMED") }
            val model = remember { AppointmentCancellation(object : CancellationService {
                override suspend fun find(identity: Identity, appointmentId: String) = appointment.copy(status = if (posts > 0) "CANCELLED" else "CONFIRMED")
                override suspend fun cancel(identity: Identity, appointmentId: String) { posts++; if (uncertain) throw ApiFailure() }
            }, contract.cancellation, scope) }
            val state by model.state.collectAsState()
            MobileTheme(content) {
                TextButton(onClick = { model.open(identity, appointment) }) { Text(content.text("cancelAppointment")) }
                CancellationDialog(state, content, model::confirm, model::check, { model.close() })
            }
        }
        compose.onNodeWithText(content.text("cancelAppointment")).performClick()
    }
    @Test fun keepingAppointmentDoesNotSendAnyMutation() {
        show(); compose.onNodeWithText(content.text("keepAppointment")).performClick(); assertEquals(0, posts)
        compose.onNodeWithText(content.text("confirmCancellation")).assertDoesNotExist()
    }
    @Test fun explicitConfirmShowsReadbackWithoutRefundGuarantee() {
        show(); compose.onNodeWithText(content.text("cancelConfirmation")).assertIsDisplayed(); assertEquals(0, posts)
        compose.onNodeWithText(content.text("confirmCancellation")).performClick()
        compose.onNodeWithText(content.text("cancellationConfirmed")).assertIsDisplayed(); assertEquals(1, posts)
    }
    @Test fun lostResponseOffersStatusCheckWithoutSecondPost() {
        uncertain = true; show(); compose.onNodeWithText(content.text("confirmCancellation")).performClick()
        compose.onNodeWithText(content.text("cancellationUnconfirmed")).assertIsDisplayed()
        compose.onNodeWithText(content.text("checkCancellation")).performClick()
        compose.onNodeWithText(content.text("cancellationConfirmed")).assertIsDisplayed(); assertEquals(1, posts)
    }
}
