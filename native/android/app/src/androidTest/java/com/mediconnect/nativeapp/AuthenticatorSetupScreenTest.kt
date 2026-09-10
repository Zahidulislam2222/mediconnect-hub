package com.mediconnect.nativeapp

import androidx.activity.ComponentActivity
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.test.platform.app.InstrumentationRegistry
import com.amplifyframework.auth.TOTPSetupDetails
import com.amplifyframework.auth.result.step.AuthNextSignInStep
import com.amplifyframework.auth.result.step.AuthSignInStep
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class AuthenticatorSetupScreenTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    private fun read(name: String) = JSONObject(assets.open(name).bufferedReader().use { it.readText() })
    private val content = MobileContent(read("mobile-content.json"))
    private val policies = MobilePolicies(read("legal.json"), read("consent.json"))
    private val setup = AuthenticatorSetup.fromSdk(AuthNextSignInStep(AuthSignInStep.CONTINUE_SIGN_IN_WITH_TOTP_SETUP,
        emptyMap(), null, TOTPSetupDetails("test-key", "test-user"), null, null))!!
    private val state = mutableStateOf(WorkspaceState(challenge = true, challengeInput = ChallengeInput.TOTP_SETUP, authenticatorSetup = setup))
    private fun show(confirm: (String) -> Unit = {}, cancel: () -> Unit = {}) {
        val lifecycle = compose.activity.lifecycle
        compose.setContent {
            DisposableEffect(lifecycle) {
                val observer = LifecycleEventObserver { _, event ->
                    if (event == Lifecycle.Event.ON_STOP) {
                        val current = state.value
                        state.value = if (SignInChallenge.retainForAuthenticator(current.challenge, current.challengeInput, current.authenticatorSetup, current.busy, current.identity != null))
                            current.copy(visible = false) else WorkspaceState(visible = false)
                    } else if (event == Lifecycle.Event.ON_START) state.value = state.value.copy(visible = true)
                }
                lifecycle.addObserver(observer)
                onDispose { lifecycle.removeObserver(observer) }
            }
            MobileTheme(content) {
                WorkspaceScreen(state.value, content, true, "US", { _, _ -> }, confirm, cancel, {},
                    RecoveryState(), {}, {}, { _, _ -> }, {}, policies, RegistrationState(), {}, {}, { _, _, _ -> }, {}, {}, {})
            }
        }
    }
    @Test fun revealRequiresActionAndSubmitHidesKeyAndClearsCode() {
        var submitted: String? = null
        show(confirm = { submitted = SignInChallenge.response(ChallengeInput.TOTP_SETUP, it) })
        compose.onNodeWithText("test-key").assertDoesNotExist()
        compose.onNodeWithText(content.text("revealSetupKey")).performScrollTo().performClick()
        compose.onNodeWithText("test-key").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText(content.text("code")).performScrollTo().performTextInput("123456")
        compose.onNodeWithText(content.text("verify")).performScrollTo().performClick()
        assertEquals("123456", submitted)
        compose.onNodeWithText("test-key").assertDoesNotExist()
        compose.onNodeWithText(content.text("verify")).assertIsNotEnabled()
    }
    @Test fun appSwitchRetainsEnrollmentWithHiddenKeyAndEmptyCode() {
        show()
        compose.onNodeWithText(content.text("revealSetupKey")).performScrollTo().performClick()
        compose.onNodeWithText(content.text("code")).performScrollTo().performTextInput("123456")
        compose.activityRule.scenario.moveToState(Lifecycle.State.CREATED)
        compose.activityRule.scenario.moveToState(Lifecycle.State.RESUMED)
        compose.onNodeWithText("test-key").assertDoesNotExist()
        compose.onNodeWithText(content.text("revealSetupKey")).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText(content.text("verify")).performScrollTo().assertIsNotEnabled()
    }
    @Test fun cancelDropsSetupAndReturnsToSignIn() {
        show(cancel = { state.value = WorkspaceState() })
        compose.onNodeWithText(content.text("revealSetupKey")).performScrollTo().performClick()
        compose.onNodeWithText(content.text("cancel")).performScrollTo().performClick()
        compose.onNodeWithText("test-key").assertDoesNotExist()
        compose.onNodeWithText(content.text("revealSetupKey")).assertDoesNotExist()
        compose.onNodeWithText(content.text("signIn")).performScrollTo().assertIsDisplayed()
    }
    @Test fun missingSetupMaterialCannotSubmit() {
        state.value = state.value.copy(authenticatorSetup = null); show()
        compose.onNodeWithText(content.text("code")).performScrollTo().performTextInput("123456")
        compose.onNodeWithText(content.text("verify")).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText(content.text("revealSetupKey")).assertDoesNotExist()
    }
}
