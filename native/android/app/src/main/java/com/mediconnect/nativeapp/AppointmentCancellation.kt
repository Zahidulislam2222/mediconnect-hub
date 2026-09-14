package com.mediconnect.nativeapp

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.coroutines.coroutineContext

interface CancellationService {
    suspend fun find(identity: Identity, appointmentId: String): Appointment
    suspend fun cancel(identity: Identity, appointmentId: String)
}
enum class CancellationStep { CLOSED, CONFIRM, PROCESSING, CONFIRMED, UNCONFIRMED }
data class CancellationState(val step: CancellationStep = CancellationStep.CLOSED, val appointment: Appointment? = null)

class AppointmentCancellation(private val service: CancellationService?, private val policy: CancellationContract?,
                              private val scope: CoroutineScope) {
    private val mutable = MutableStateFlow(CancellationState())
    val state = mutable.asStateFlow()
    private var identity: Identity? = null
    private var operation: Job? = null
    private var generation = 0
    private val attempted = mutableSetOf<Pair<String, String>>()

    fun close(clearSession: Boolean = false) {
        generation++; operation?.cancel(); identity = null; mutable.value = CancellationState()
        if (clearSession) attempted.clear()
    }
    fun open(identity: Identity, appointment: Appointment) {
        if (service == null || policy == null || identity.role != Role.PATIENT || appointment.id.isBlank()) return
        close(); this.identity = identity
        mutable.value = CancellationState(
            if (attempted.contains(identity.subject to appointment.id)) CancellationStep.UNCONFIRMED else CancellationStep.CONFIRM, appointment)
    }
    fun confirm() { if (mutable.value.step == CancellationStep.CONFIRM) run(submit = true) }
    fun check() { if (mutable.value.step == CancellationStep.UNCONFIRMED) run(submit = false) }
    private fun run(submit: Boolean) {
        val service = service ?: return
        val policy = policy ?: return
        val identity = identity ?: return
        val selected = mutable.value.appointment ?: return
        val current = ++generation
        mutable.value = CancellationState(CancellationStep.PROCESSING, selected)
        operation = scope.launch {
            try {
                var latest = service.find(identity, selected.id)
                coroutineContext.ensureActive()
                require(latest.id == selected.id)
                if (latest.status !in policy.cancelledStatuses && submit) {
                    require(latest.status in policy.cancellableStatuses)
                    require(attempted.add(identity.subject to selected.id))
                    service.cancel(identity, selected.id)
                    coroutineContext.ensureActive()
                    latest = service.find(identity, selected.id)
                    coroutineContext.ensureActive()
                }
                require(latest.id == selected.id && latest.status in policy.cancelledStatuses)
                if (current == generation) mutable.value = CancellationState(CancellationStep.CONFIRMED, latest)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) {
                if (current == generation) mutable.value = CancellationState(CancellationStep.UNCONFIRMED, selected)
            }
        }
    }
}
