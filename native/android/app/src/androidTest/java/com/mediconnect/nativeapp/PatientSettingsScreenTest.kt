package com.mediconnect.nativeapp

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.time.Instant

class PatientSettingsScreenTest {
    @get:Rule val compose = createComposeRule()
    private val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    private fun read(name: String) = JSONObject(assets.open(name).bufferedReader().use { it.readText() })
    private val content = MobileContent(read("mobile-content.json"))
    private val contract = MobileContract(read("mobile-contract.json"), read("session-policy.json"))
    private var writes = 0
    private var failReadback = false
    private var saved = PatientSettingsSnapshot("test-patient", "Test Patient", "test@example.invalid", null, null, null)
    private lateinit var editor: PatientSettingsEditor
    private fun label(key: String) = content.label("settings", key)
    private fun show() {
        compose.setContent {
            val scope = rememberCoroutineScope()
            val model = remember {
                PatientSettingsEditor(object : PatientSettingsService {
                    override suspend fun load(identity: Identity): PatientSettingsSnapshot {
                        if (writes > 0 && failReadback) throw ApiFailure()
                        return saved
                    }
                    override suspend fun save(identity: Identity, snapshot: PatientSettingsSnapshot, draft: PatientSettingsDraft) {
                        writes++
                        saved = snapshot.copy(name = draft.name, phone = draft.phone, address = draft.address, preferences = draft.preferences)
                    }
                }, contract.patientSettings.maxNameLength, scope).also {
                    editor = it
                    it.open(Identity(saved.subject, Role.PATIENT, Instant.now().plusSeconds(300)))
                }
            }
            val state by model.state.collectAsState()
            MobileTheme(content) {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    PatientSettingsForm(state, content, model::edit, model::save, model::discard, model::reload, model::close)
                }
            }
        }
    }
    @Test fun editDiscardAndSavePreserveAbsentPreferencesAndReadOnlyEmail() {
        show()
        compose.onNodeWithText("test@example.invalid").performScrollTo().assert(hasSetTextAction().not())
        compose.onNodeWithText(label("phone")).performScrollTo().performTextInput("test-phone")
        compose.onNodeWithText(label("discard")).performScrollTo().performClick()
        compose.runOnIdle { assertNull(editor.state.value.draft!!.phone); assertEquals(0, writes) }
        compose.onNodeWithText(content.text("fullName")).performScrollTo().performTextReplacement("Changed Patient")
        compose.onNodeWithContentDescription(content.label("settingsPreferences", "email")).performScrollTo().performClick()
        compose.onNodeWithText(label("save")).performScrollTo().performClick()
        compose.onNodeWithText(content.label("settingsStatus", "SAVED")).performScrollTo().assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(1, writes)
            assertEquals("Changed Patient", saved.name)
            assertEquals("test@example.invalid", saved.email)
            assertEquals(mapOf("email" to true), saved.preferences)
            assertNull(saved.phone); assertNull(saved.address)
        }
    }
    @Test fun failedReadbackBlocksDuplicateWriteUntilExplicitReloadAndCloseClearsDraft() {
        failReadback = true; show()
        compose.onNodeWithText(label("address")).performScrollTo().performTextInput("Test address")
        compose.onNodeWithText(label("save")).performScrollTo().performClick()
        compose.onNodeWithText(content.label("settingsStatus", "SAVE_UNCERTAIN")).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText(label("save")).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText(label("discard")).performScrollTo().assertIsNotEnabled()
        compose.runOnIdle { assertEquals(1, writes); failReadback = false }
        compose.onNodeWithText(label("reload")).performScrollTo().performClick()
        compose.runOnIdle { assertEquals("Test address", editor.state.value.draft!!.address); assertEquals(1, writes) }
        compose.onNodeWithText(label("close")).performScrollTo().performClick()
        compose.runOnIdle { assertEquals(SettingsState(), editor.state.value) }
    }
}
