package com.mediconnect.nativeapp

import android.view.View
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.SoftwareKeyboardController
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.time.Instant

class PatientSettingsWorkspaceAccessibilityTest {
    @get:Rule val compose = createComposeRule()
    private val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    private fun read(name: String) = JSONObject(assets.open(name).bufferedReader().use { it.readText() })
    private val content = MobileContent(read("mobile-content.json"))
    private val policies = MobilePolicies(read("legal.json"), read("consent.json"))
    private val contract = MobileContract(read("mobile-contract.json"), read("session-policy.json"))
    private var saved = PatientSettingsSnapshot("test-patient", "Test Patient", "test@example.invalid", null, null, null)
    private var writes = 0
    private lateinit var editor: PatientSettingsEditor
    private lateinit var view: View
    private var keyboard: SoftwareKeyboardController? = null
    private fun label(key: String) = content.label("settings", key)
    private fun show() {
        compose.setContent {
            val scope = rememberCoroutineScope()
            val identity = remember { Identity(saved.subject, Role.PATIENT, Instant.now().plusSeconds(300)) }
            val model = remember {
                PatientSettingsEditor(object : PatientSettingsService {
                    override suspend fun load(identity: Identity) = saved
                    override suspend fun save(identity: Identity, snapshot: PatientSettingsSnapshot, draft: PatientSettingsDraft) {
                        writes++
                        saved = snapshot.copy(name = draft.name, phone = draft.phone, address = draft.address, preferences = draft.preferences)
                    }
                }, contract.patientSettings.maxNameLength, scope).also { editor = it }
            }
            val settings by model.state.collectAsState()
            view = LocalView.current; keyboard = LocalSoftwareKeyboardController.current
            CompositionLocalProvider(LocalDensity provides Density(LocalDensity.current.density, 2f)) {
                Box(Modifier.width(320.dp)) { MobileTheme(content) {
                    WorkspaceScreen(WorkspaceState(identity = identity), content, true, "US", { _, _ -> }, {}, {}, {},
                        RecoveryState(), {}, {}, { _, _ -> }, {}, policies, RegistrationState(), {}, {}, { _, _, _ -> }, {}, {}, {},
                        profile = ProfileState(ProfileStep.READY, OwnProfile(identity.subject, saved.name, saved.email)),
                        settings = settings, settingsAvailable = true, openSettings = { model.open(identity) },
                        editSettings = model::edit, saveSettings = model::save, discardSettings = model::discard,
                        reloadSettings = model::reload, closeSettings = model::close)
                } }
            }
        }
    }
    private fun reveal(matcher: SemanticsMatcher): SemanticsNodeInteraction {
        val list = compose.onNode(hasScrollToIndexAction())
        list.performScrollToNode(matcher)
        val node = compose.onNode(matcher).performScrollTo().assertIsDisplayed()
        val item = node.getUnclippedBoundsInRoot()
        val viewport = list.getUnclippedBoundsInRoot()
        assertTrue("Control extends above viewport", item.top >= viewport.top)
        assertTrue("Control extends below viewport", item.bottom <= viewport.bottom)
        assertTrue("Control extends left of viewport", item.left >= viewport.left)
        assertTrue("Control extends right of viewport", item.right <= viewport.right)
        return node
    }
    private fun imeVisible(): Boolean = ViewCompat.getRootWindowInsets(view)?.isVisible(WindowInsetsCompat.Type.ime()) == true
    @Test fun narrowDoubleTextWorkspaceKeepsSettingsReachableWithRealKeyboard() {
        show()
        reveal(hasText(label("open")) and hasClickAction()).performClick()
        val name = reveal(hasText(content.text("fullName")) and hasSetTextAction())
        name.performClick().performTextReplacement("Changed Patient")
        compose.runOnIdle { keyboard?.show() }
        compose.waitUntil(5000) { imeVisible() }
        reveal(hasText(label("phone")) and hasSetTextAction()).performTextInput("test-phone")
        reveal(hasText(label("address")) and hasSetTextAction()).performTextInput("Test address")
        reveal(hasContentDescription(content.label("settingsPreferences", "sms"))).performClick()
        assertTrue("Keyboard must remain visible while reaching Save", imeVisible())
        reveal(hasText(label("save")) and hasClickAction()).performClick()
        compose.runOnIdle {
            assertEquals(1, writes); assertEquals(SettingsStep.SAVED, editor.state.value.step)
            assertEquals("Changed Patient", saved.name); assertEquals("test-phone", saved.phone)
            assertEquals("Test address", saved.address); assertEquals(mapOf("sms" to true), saved.preferences)
            assertEquals("test@example.invalid", saved.email)
        }
        reveal(hasText(label("close")) and hasClickAction()).performClick()
        compose.runOnIdle { assertEquals(SettingsState(), editor.state.value) }
    }
}
