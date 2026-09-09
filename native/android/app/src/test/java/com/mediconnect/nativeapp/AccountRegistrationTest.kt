package com.mediconnect.nativeapp

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.After
import org.junit.Assert.*
import org.junit.Test

class AccountRegistrationTest {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
    private class Fake : RegistrationService {
        var registrations = 0; var confirmations = 0; var resends = 0
        var register: suspend () -> Boolean = { false }
        var confirm: suspend () -> Boolean = { true }
        var resend: suspend () -> Unit = {}
        override suspend fun register(username: String, password: String, name: String): Boolean {
            registrations++; assertEquals("test-user@example.test", username)
            assertTrue(password == " test-password "); assertEquals("Test person", name)
            return register()
        }
        override suspend fun confirmRegistration(username: String, code: String): Boolean {
            confirmations++; assertEquals("test-user@example.test", username); assertEquals("123456", code)
            return confirm()
        }
        override suspend fun resendRegistration(username: String) {
            resends++; assertEquals("test-user@example.test", username); resend()
        }
    }
    @After fun close() { scope.cancel() }
    private fun create(model: AccountRegistration) { model.register(" test-user@example.test ", " test-password ", " Test person ") }
    @Test fun consentAndRequiredDetailsBlockRegistration() {
        val service = Fake(); val model = AccountRegistration(service, scope); model.open(); create(model)
        assertEquals(0, service.registrations); model.accept(true)
        model.register(" ", " test-password ", "Test person"); model.register("test-user@example.test", "", "Test person")
        model.register("test-user@example.test", " test-password ", " "); assertEquals(0, service.registrations)
        model.close(); model.open(); assertFalse(model.state.value.accepted)
    }
    @Test fun registerResendConfirmCompleteUsesOriginalUsername() {
        val service = Fake(); val model = AccountRegistration(service, scope); model.open(); model.accept(true); create(model)
        assertEquals(RegistrationStep.CONFIRM, model.state.value.step)
        model.resend(); assertEquals(1, service.resends); assertTrue(model.state.value.codeRequested)
        create(model); model.confirm(" 123456 ")
        assertEquals(RegistrationStep.COMPLETE, model.state.value.step)
        model.confirm("123456"); model.resend(); assertEquals(1, service.registrations); assertEquals(1, service.confirmations); assertEquals(1, service.resends)
    }
    @Test fun completedSignupSkipsConfirmationWithoutAutomaticSignIn() {
        val service = Fake().apply { register = { true } }; val model = AccountRegistration(service, scope)
        model.open(); model.accept(true); create(model)
        assertEquals(RegistrationStep.COMPLETE, model.state.value.step); assertEquals(0, service.confirmations)
    }
    @Test fun incompleteConfirmationAndProviderFailureRemainRetryable() {
        val service = Fake().apply { confirm = { false } }; val model = AccountRegistration(service, scope)
        model.resumeConfirmation(" test-user@example.test "); model.confirm("123456")
        assertTrue(model.state.value.failed); assertEquals(RegistrationStep.CONFIRM, model.state.value.step)
        service.resend = { error("TEST_FAILURE") }; model.resend(); assertTrue(model.state.value.failed)
        service.resend = {}; model.resend(); assertFalse(model.state.value.failed)
        service.confirm = { true }; model.confirm("123456"); assertEquals(RegistrationStep.COMPLETE, model.state.value.step)
    }
    @Test fun missingConfigurationAndWrongStepsNeverInvokeProvider() {
        val model = AccountRegistration(null, scope); model.open(); model.accept(true); create(model); model.resumeConfirmation("test-user@example.test")
        assertEquals(RegistrationState(), model.state.value)
        val service = Fake(); val configured = AccountRegistration(service, scope); configured.confirm("123456"); configured.resend()
        configured.open(); configured.confirm("123456"); configured.resend(); assertEquals(0, service.confirmations + service.resends)
    }
    @Test fun duplicateAndLateRegistrationCannotReopenCancelledForm() = runBlocking {
        val pending = CompletableDeferred<Boolean>(); val service = Fake().apply { register = { withContext(NonCancellable) { pending.await() } } }
        val model = AccountRegistration(service, scope); model.open(); model.accept(true); create(model); create(model)
        assertEquals(1, service.registrations); assertTrue(model.state.value.busy)
        model.close(); model.open(); pending.complete(false)
        assertEquals(RegistrationState(RegistrationStep.DETAILS), model.state.value)
    }
    @Test fun cancellationClearsConfirmationSubject() {
        val service = Fake(); val model = AccountRegistration(service, scope); model.resumeConfirmation("test-user@example.test")
        model.close(); model.confirm("123456"); model.resend()
        assertEquals(0, service.confirmations + service.resends); assertEquals(RegistrationState(), model.state.value)
    }
    @Test fun registrationFailureAllowsAnExplicitRetry() {
        val service = Fake().apply { register = { error("TEST_FAILURE") } }; val model = AccountRegistration(service, scope)
        model.open(); model.accept(true); create(model); assertTrue(model.state.value.failed)
        service.register = { false }; create(model); assertEquals(RegistrationStep.CONFIRM, model.state.value.step)
        assertEquals(2, service.registrations)
    }
}
