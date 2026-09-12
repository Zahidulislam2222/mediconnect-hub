package com.mediconnect.nativeapp

import android.content.ComponentName
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.test.platform.app.InstrumentationRegistry
import com.amplifyframework.auth.TOTPSetupDetails
import com.amplifyframework.auth.result.step.AuthNextSignInStep
import com.amplifyframework.auth.result.step.AuthSignInStep
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val productionActivity = context.packageManager.getActivityInfo(
            ComponentName(context, MainActivity::class.java), 0)
        assertEquals(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE,
            productionActivity.softInputMode and WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST)
        compose.runOnUiThread {
            assertEquals(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE,
                compose.activity.window.attributes.softInputMode and WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST)
        }
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
        var confirmCalls = 0
        show(confirm = { confirmCalls++; submitted = SignInChallenge.response(ChallengeInput.TOTP_SETUP, it) })
        compose.onNodeWithText("test-key").assertDoesNotExist()
        compose.onNodeWithText(content.text("revealSetupKey")).performScrollTo().performClick()
        compose.onNodeWithText("test-key").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText(content.text("code")).performScrollTo().performTextInput("123456")
        compose.onNodeWithText(content.text("code")).assertTextContains("123456")
        val window = compose.activity.window
        compose.runOnUiThread {
            WindowCompat.getInsetsController(window, window.decorView).show(WindowInsetsCompat.Type.ime())
        }
        compose.waitUntil(5000) {
            compose.runOnUiThread {
                ViewCompat.getRootWindowInsets(window.decorView)?.isVisible(WindowInsetsCompat.Type.ime()) == true
            }
        }
        val matcher = hasText(content.text("verify")) and hasClickAction()
        val list = compose.onNode(hasScrollToIndexAction()).performScrollToNode(matcher)
        val verify = compose.onNode(matcher).performScrollTo().assertIsEnabled().assertIsDisplayed()
        val control = verify.getUnclippedBoundsInRoot()
        val viewport = list.getUnclippedBoundsInRoot()
        assertTrue("Verify must have positive visible dimensions", control.right > control.left && control.bottom > control.top)
        assertTrue("Verify must fit inside its scroll viewport", control.top >= viewport.top && control.bottom <= viewport.bottom &&
            control.left >= viewport.left && control.right <= viewport.right)
        val before = verify.fetchSemanticsNode().boundsInWindow
        val rootBefore = compose.onRoot().fetchSemanticsNode().boundsInWindow
        val imeBefore = compose.runOnIdle {
            val insets = ViewCompat.getRootWindowInsets(compose.activity.window.decorView)
            assertTrue("Keyboard must remain visible while reaching Verify", insets?.isVisible(WindowInsetsCompat.Type.ime()) == true)
            "visible=${insets?.isVisible(WindowInsetsCompat.Type.ime())}, bottom=${insets?.getInsets(WindowInsetsCompat.Type.ime())?.bottom}"
        }
        verify.performClick()
        val after = verify.fetchSemanticsNode().boundsInWindow
        compose.runOnIdle {
            assertEquals("Verify must invoke exactly one confirmation callback; before=$before; after=$after; root=$rootBefore; IME=$imeBefore", 1, confirmCalls)
            assertEquals("123456", submitted)
        }
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
