package com.mediconnect.nativeapp

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

interface RegistrationService {
    suspend fun register(username: String, password: String, name: String): Boolean
    suspend fun confirmRegistration(username: String, code: String): Boolean
    suspend fun resendRegistration(username: String)
}

enum class RegistrationStep { CLOSED, DETAILS, CONFIRM, COMPLETE }
data class RegistrationState(val step: RegistrationStep = RegistrationStep.CLOSED,
    val accepted: Boolean = false, val busy: Boolean = false, val failed: Boolean = false, val codeRequested: Boolean = false)

class AccountRegistration(private val service: RegistrationService?, private val scope: CoroutineScope) {
    private val mutable = MutableStateFlow(RegistrationState())
    val state = mutable.asStateFlow()
    private var username: String? = null
    private var operation: Job? = null
    private var generation = 0L

    fun close() {
        generation++; operation?.cancel(); operation = null; username = null
        mutable.value = RegistrationState()
    }
    fun open() { close(); if (service != null) mutable.value = RegistrationState(RegistrationStep.DETAILS) }
    fun accept(value: Boolean) {
        if (mutable.value.step == RegistrationStep.DETAILS && !mutable.value.busy) {
            mutable.value = mutable.value.copy(accepted = value)
        }
    }
    fun resumeConfirmation(value: String) {
        close()
        if (service != null && value.isNotBlank()) {
            username = value.trim(); mutable.value = RegistrationState(RegistrationStep.CONFIRM)
        }
    }
    fun register(email: String, password: String, name: String) {
        val service = service ?: return
        val current = mutable.value
        if (current.step != RegistrationStep.DETAILS || current.busy || !current.accepted ||
            email.isBlank() || name.isBlank() || password.isEmpty()) return
        val subject = email.trim(); username = subject
        run {
            val complete = service.register(subject, password, name.trim())
            currentCoroutineContext().ensureActive()
            if (complete) username = null
            mutable.value = RegistrationState(if (complete) RegistrationStep.COMPLETE else RegistrationStep.CONFIRM)
        }
    }
    fun confirm(code: String) {
        val service = service ?: return
        val subject = username ?: return
        if (mutable.value.step != RegistrationStep.CONFIRM || mutable.value.busy || code.isBlank()) return
        run {
            val complete = service.confirmRegistration(subject, code.trim())
            currentCoroutineContext().ensureActive()
            if (complete) { username = null; mutable.value = RegistrationState(RegistrationStep.COMPLETE) }
            else mutable.value = mutable.value.copy(failed = true)
        }
    }
    fun resend() {
        val service = service ?: return
        val subject = username ?: return
        if (mutable.value.step != RegistrationStep.CONFIRM || mutable.value.busy) return
        run {
            service.resendRegistration(subject)
            currentCoroutineContext().ensureActive()
            mutable.value = mutable.value.copy(codeRequested = true)
        }
    }
    private fun run(block: suspend () -> Unit) {
        val current = ++generation
        mutable.value = mutable.value.copy(busy = true, failed = false, codeRequested = false)
        operation = scope.launch {
            try { block() }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { if (current == generation) mutable.value = mutable.value.copy(failed = true) }
            finally { if (current == generation) mutable.value = mutable.value.copy(busy = false) }
        }
    }
}
