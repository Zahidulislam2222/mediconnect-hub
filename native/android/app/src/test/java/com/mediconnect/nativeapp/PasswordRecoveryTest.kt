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

class PasswordRecoveryTest {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
    private class Fake : PasswordRecoveryService {
        var requests = 0
        var confirmations = 0
        var username: String? = null
        var request: suspend () -> Boolean = { false }
        var confirm: suspend () -> Unit = {}
        override suspend fun requestReset(username: String): Boolean {
            requests++; this.username = username; return request()
        }
        override suspend fun confirmReset(username: String, password: String, code: String) {
            confirmations++; assertEquals(this.username, username)
            assertTrue(password == " test-password "); assertTrue(code == "123456")
            confirm()
        }
    }
    @After fun cleanUp() { scope.cancel() }
    @Test fun requestConfirmCompleteUsesOriginalUsernameAndExactPassword() {
        val service = Fake(); val recovery = PasswordRecovery(service, scope)
        recovery.open(); recovery.request(" test-user@example.test ")
        assertEquals("test-user@example.test", service.username)
        assertEquals(RecoveryStep.CONFIRM, recovery.state.value.step)
        recovery.request("another@example.test")
        recovery.confirm(" test-password ", " 123456 ")
        assertEquals(RecoveryStep.COMPLETE, recovery.state.value.step)
        recovery.confirm(" test-password ", "123456")
        assertEquals(1, service.requests); assertEquals(1, service.confirmations)
    }
    @Test fun sdkCompletionSkipsCodeForm() {
        val service = Fake().apply { request = { true } }; val recovery = PasswordRecovery(service, scope)
        recovery.open(); recovery.request("test-user@example.test")
        assertEquals(RecoveryStep.COMPLETE, recovery.state.value.step)
    }
    @Test fun missingConfigurationAndEmptyInputsNeverCallService() {
        val blocked = PasswordRecovery(null, scope); blocked.open()
        assertEquals(RecoveryStep.CLOSED, blocked.state.value.step)
        val service = Fake(); val recovery = PasswordRecovery(service, scope)
        recovery.open(); recovery.request(" "); recovery.confirm("", "")
        assertEquals(0, service.requests); assertEquals(0, service.confirmations)
    }
    @Test fun requestFailureCanRetryWithoutFalseCompletion() {
        val service = Fake().apply { request = { error("TEST_PROVIDER_FAILURE") } }
        val recovery = PasswordRecovery(service, scope); recovery.open(); recovery.request("test-user@example.test")
        assertTrue(recovery.state.value.failed); assertFalse(recovery.state.value.busy)
        assertEquals(RecoveryStep.REQUEST, recovery.state.value.step)
        service.request = { false }; recovery.request("test-user@example.test")
        assertFalse(recovery.state.value.failed); assertEquals(RecoveryStep.CONFIRM, recovery.state.value.step)
    }
    @Test fun rejectedConfirmationAllowsRetry() {
        val service = Fake().apply { confirm = { error("TEST_REJECTED_CODE") } }
        val recovery = PasswordRecovery(service, scope); recovery.open(); recovery.request("test-user@example.test")
        recovery.confirm(" test-password ", "123456")
        assertTrue(recovery.state.value.failed); assertEquals(RecoveryStep.CONFIRM, recovery.state.value.step)
        service.confirm = {}; recovery.confirm(" test-password ", "123456")
        assertEquals(RecoveryStep.COMPLETE, recovery.state.value.step)
    }
    @Test fun duplicateRequestAndLateCompletionCannotReopenClosedFlow() = runBlocking {
        val gate = CompletableDeferred<Boolean>()
        val service = Fake().apply { request = { withContext(NonCancellable) { gate.await() } } }
        val recovery = PasswordRecovery(service, scope); recovery.open(); recovery.request("test-user@example.test")
        recovery.request("test-user@example.test"); assertEquals(1, service.requests)
        recovery.close(); gate.complete(false)
        assertEquals(RecoveryState(), recovery.state.value)
        recovery.confirm(" test-password ", "123456"); assertEquals(0, service.confirmations)
    }
    @Test fun cancelledConfirmationCannotOverwriteANewRecoveryAttempt() = runBlocking {
        val gate = CompletableDeferred<Unit>()
        val service = Fake().apply { confirm = { withContext(NonCancellable) { gate.await() } } }
        val recovery = PasswordRecovery(service, scope); recovery.open(); recovery.request("test-user@example.test")
        recovery.confirm(" test-password ", "123456"); recovery.confirm(" test-password ", "123456")
        assertEquals(1, service.confirmations)
        recovery.close(); recovery.open(); gate.complete(Unit)
        assertEquals(RecoveryState(RecoveryStep.REQUEST), recovery.state.value)
    }
}
