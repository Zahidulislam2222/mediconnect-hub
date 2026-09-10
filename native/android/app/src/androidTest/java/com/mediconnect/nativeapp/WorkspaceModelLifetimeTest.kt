package com.mediconnect.nativeapp

import androidx.test.platform.app.InstrumentationRegistry
import com.amplifyframework.auth.TOTPSetupDetails
import com.amplifyframework.auth.result.AuthSignInResult
import com.amplifyframework.auth.result.step.AuthNextSignInStep
import com.amplifyframework.auth.result.step.AuthSignInStep
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

/** Tests the real workspace model with deliberately non-cooperative provider completions. */
class WorkspaceModelLifetimeTest {
    private val application = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as MediConnectApplication
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
    private val cleanups = mutableListOf<() -> Unit>()
    private val identity = Identity("test-patient", Role.PATIENT, Instant.now().plusSeconds(3600))
    private fun result(signedIn: Boolean = false, step: AuthSignInStep = AuthSignInStep.CONTINUE_SIGN_IN_WITH_TOTP_SETUP) =
        AuthSignInResult(signedIn, AuthNextSignInStep(if (signedIn) AuthSignInStep.DONE else step, emptyMap(), null,
            if (!signedIn && step == AuthSignInStep.CONTINUE_SIGN_IN_WITH_TOTP_SETUP) TOTPSetupDetails("test-key", "test-user") else null,
            null, null))

    private class Pending<T> {
        private var continuation: Continuation<T>? = null
        suspend fun await(): T = suspendCoroutine { check(continuation == null); continuation = it }
        fun complete(value: T) { val current = checkNotNull(continuation); continuation = null; current.resume(value) }
        fun fail(failure: Exception) { val current = checkNotNull(continuation); continuation = null; current.resumeWithException(failure) }
        fun close() { continuation?.let { continuation = null; it.resumeWithException(CancellationException("TEST_CLEANUP")) } }
    }
    private fun <T> pending() = Pending<T>().also { cleanups += it::close }

    private inner class Fake : WorkspaceServices, SignInSession, ProfileService, WorkspaceAppointments {
        override val sessions: SignInSession get() = this
        override val profiles: ProfileService get() = this
        override val appointments: WorkspaceAppointments get() = this
        override val contract = MobileContract(read("mobile-contract.json"), read("session-policy.json"))
        override var requiresExplicitSignIn = true
        var confirmations = 0
        var fetches = 0
        var profileLoads = 0
        var confirmation: suspend () -> AuthSignInResult = { result(true) }
        var signInResult = result()
        var session: suspend () -> SessionAccess = { SessionAccess(identity, "test-token") }
        private fun read(name: String) = JSONObject(application.assets.open(name).bufferedReader().use { it.readText() })
        override suspend fun signIn(email: String, password: String) = signInResult
        override suspend fun confirm(code: String): AuthSignInResult { confirmations++; return confirmation() }
        override suspend fun fetch(): SessionAccess { fetches++; return session() }
        override suspend fun signOut() {}
        override suspend fun load(identity: Identity): OwnProfile { profileLoads++; return OwnProfile(identity.subject, "Test Patient", "test@example.invalid") }
        override suspend fun create(identity: Identity, details: ProfileDetails, policyVersion: String) = error("UNEXPECTED_TEST_CREATE")
        override suspend fun load(identity: Identity, cursor: String?) = AppointmentPage(emptyList(), null)
        override suspend fun find(identity: Identity, appointmentId: String): Appointment = error("UNEXPECTED_TEST_FIND")
        override suspend fun cancel(identity: Identity, appointmentId: String) = error("UNEXPECTED_TEST_CANCEL")
        override suspend fun requestReset(username: String): Boolean = error("UNEXPECTED_TEST_RESET")
        override suspend fun confirmReset(username: String, password: String, code: String) = error("UNEXPECTED_TEST_RESET")
        override suspend fun register(username: String, password: String, name: String): Boolean = error("UNEXPECTED_TEST_REGISTRATION")
        override suspend fun confirmRegistration(username: String, code: String): Boolean = error("UNEXPECTED_TEST_REGISTRATION")
        override suspend fun resendRegistration(username: String) = error("UNEXPECTED_TEST_REGISTRATION")
    }
    private fun model(fake: Fake) = WorkspaceModel(application, fake, scope).also {
        it.signIn("test@example.invalid", "test-password")
        assertTrue(it.state.value.challenge)
        assertFalse(it.state.value.busy)
    }
    @After fun close() { scope.cancel(); cleanups.forEach { it() } }

    @Test fun idleAuthenticatorSurvivesBackgroundWithoutAuthenticating() {
        val fake = Fake(); val model = model(fake)
        model.hide(); assertFalse(model.state.value.visible)
        model.resume()
        assertTrue(model.state.value.visible); assertTrue(model.state.value.challenge)
        assertNotNull(model.state.value.authenticatorSetup); assertNull(model.state.value.identity)
        assertEquals(0, fake.confirmations); assertEquals(0, fake.fetches); assertEquals(0, fake.profileLoads)
        assertTrue(fake.requiresExplicitSignIn)
    }
    @Test fun lateSignedInConfirmationAfterBackgroundCannotRestoreSession() {
        val held = pending<AuthSignInResult>(); val fake = Fake().apply { confirmation = { held.await() } }; val model = model(fake)
        model.confirm("123456"); model.hide(); held.complete(result(true))
        assertEquals(WorkspaceState(visible = false), model.state.value)
        assertEquals(0, fake.fetches); assertEquals(0, fake.profileLoads); assertTrue(fake.requiresExplicitSignIn)
    }
    @Test fun lateChallengeAfterBackgroundCannotRestoreSetup() {
        val held = pending<AuthSignInResult>(); val fake = Fake().apply { confirmation = { held.await() } }; val model = model(fake)
        model.confirm("123456"); model.hide(); held.complete(result())
        assertEquals(WorkspaceState(visible = false), model.state.value)
        assertEquals(0, fake.fetches); assertEquals(0, fake.profileLoads)
    }
    @Test fun lateConfirmationAfterExplicitSignOutCannotClearLatch() {
        val held = pending<AuthSignInResult>(); val fake = Fake().apply { confirmation = { held.await() } }; val model = model(fake)
        model.confirm("123456"); model.signOut(); held.complete(result(true))
        assertEquals(WorkspaceState(), model.state.value); assertTrue(fake.requiresExplicitSignIn)
        assertEquals(0, fake.fetches); assertEquals(0, fake.profileLoads)
    }
    @Test fun lateSessionFetchAfterBackgroundCannotLoadProfile() {
        val held = pending<SessionAccess>(); val fake = Fake().apply { session = { held.await() } }; val model = model(fake)
        model.confirm("123456"); assertEquals(1, fake.fetches)
        model.hide(); held.complete(SessionAccess(identity, "test-token"))
        assertEquals(WorkspaceState(visible = false), model.state.value)
        assertEquals(0, fake.profileLoads); assertTrue(fake.requiresExplicitSignIn)
    }
    @Test fun cancelledOldSuccessCannotOverwriteNewChallenge() {
        val held = pending<AuthSignInResult>(); val fake = Fake().apply { confirmation = { held.await() } }; val model = model(fake)
        model.confirm("123456"); model.signOut()
        fake.signInResult = result(step = AuthSignInStep.CONFIRM_SIGN_IN_WITH_SMS_MFA_CODE)
        model.signIn("test@example.invalid", "test-password")
        val newer = model.state.value; held.complete(result())
        assertEquals(newer, model.state.value); assertNull(model.state.value.authenticatorSetup)
        assertEquals(0, fake.fetches); assertTrue(fake.requiresExplicitSignIn)
    }
    @Test fun cancelledOldErrorCannotOverwriteNewBusyAttempt() {
        val old = pending<AuthSignInResult>(); val newer = pending<AuthSignInResult>()
        val fake = Fake().apply { confirmation = { old.await() } }; val model = model(fake)
        model.confirm("123456"); model.signOut(); model.signIn("test@example.invalid", "test-password")
        fake.confirmation = { newer.await() }; model.confirm("654321")
        val current = model.state.value; old.fail(IllegalStateException("TEST_OLD_FAILURE"))
        assertEquals(current, model.state.value); assertTrue(model.state.value.busy)
        newer.complete(result(true)); assertEquals(identity, model.state.value.identity)
    }
    @Test fun duplicateConfirmationMakesOneCallAndSuccessRequiresFreshSession() {
        val held = pending<AuthSignInResult>(); val fake = Fake().apply { confirmation = { held.await() } }; val model = model(fake)
        model.confirm("123456"); model.confirm("654321")
        assertEquals(1, fake.confirmations); assertEquals(0, fake.fetches); assertNull(model.state.value.identity)
        held.complete(result(true))
        assertEquals(1, fake.fetches); assertEquals(1, fake.profileLoads)
        assertEquals(identity, model.state.value.identity); assertFalse(fake.requiresExplicitSignIn)
    }
    @Test fun rejectedConfirmationCanRetryWithoutFalseAuthentication() {
        val fake = Fake().apply { confirmation = { error("TEST_REJECTED_CODE") } }; val model = model(fake)
        model.confirm("123456")
        assertTrue(model.state.value.challenge); assertFalse(model.state.value.busy); assertNull(model.state.value.identity)
        assertEquals(0, fake.fetches); assertTrue(fake.requiresExplicitSignIn)
        fake.confirmation = { result(true) }; model.confirm("654321")
        assertEquals(identity, model.state.value.identity); assertEquals(2, fake.confirmations)
    }
}
