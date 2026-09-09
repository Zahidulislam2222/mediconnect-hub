package com.mediconnect.nativeapp

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

interface PasswordRecoveryService {
    /** True means the SDK reports completion; false means confirmation is required. */
    suspend fun requestReset(username: String): Boolean
    suspend fun confirmReset(username: String, password: String, code: String)
}

enum class RecoveryStep { CLOSED, REQUEST, CONFIRM, COMPLETE }
data class RecoveryState(val step: RecoveryStep = RecoveryStep.CLOSED, val busy: Boolean = false, val failed: Boolean = false)

class PasswordRecovery(private val service: PasswordRecoveryService?, private val scope: CoroutineScope) {
    private val mutable = MutableStateFlow(RecoveryState())
    val state = mutable.asStateFlow()
    private var username: String? = null
    private var operation: Job? = null
    private var generation = 0L

    fun close() {
        generation++
        operation?.cancel()
        operation = null
        username = null
        mutable.value = RecoveryState()
    }
    fun open() {
        close()
        if (service != null) mutable.value = RecoveryState(RecoveryStep.REQUEST)
    }
    fun request(value: String) {
        val service = service ?: return
        val trimmed = value.trim()
        if (trimmed.isEmpty() || mutable.value.step != RecoveryStep.REQUEST || mutable.value.busy) return
        username = trimmed
        run {
            val complete = service.requestReset(trimmed)
            currentCoroutineContext().ensureActive()
            if (complete) username = null
            mutable.value = RecoveryState(if (complete) RecoveryStep.COMPLETE else RecoveryStep.CONFIRM)
        }
    }
    fun confirm(password: String, code: String) {
        val service = service ?: return
        val username = username ?: return
        if (password.isEmpty() || code.isBlank() || mutable.value.step != RecoveryStep.CONFIRM || mutable.value.busy) return
        run {
            service.confirmReset(username, password, code.trim())
            currentCoroutineContext().ensureActive()
            this.username = null
            mutable.value = RecoveryState(RecoveryStep.COMPLETE)
        }
    }
    private fun run(block: suspend () -> Unit) {
        val current = ++generation
        mutable.value = mutable.value.copy(busy = true, failed = false)
        operation = scope.launch {
            try { block() }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) {
                if (current == generation) mutable.value = mutable.value.copy(failed = true)
            } finally {
                if (current == generation) mutable.value = mutable.value.copy(busy = false)
            }
        }
    }
}
