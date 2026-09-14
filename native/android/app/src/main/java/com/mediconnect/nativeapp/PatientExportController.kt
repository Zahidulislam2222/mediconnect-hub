package com.mediconnect.nativeapp

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID
import kotlin.coroutines.coroutineContext

enum class ExportStep { CLOSED, IDLE, DOWNLOADING, READY, SELECTING, SAVING, SAVED, CANCELLED, FAILED }
data class ExportState(val step: ExportStep = ExportStep.CLOSED, val ticket: UUID? = null)

/** Call transitions on the UI thread. State never contains patient data or a destination URI. */
class PatientExportController(private val service: PatientExportService, private val sessions: SessionProvider,
                              private val scope: CoroutineScope) {
    private val mutable = MutableStateFlow(ExportState())
    val state = mutable.asStateFlow()
    @Volatile private var owner: Identity? = null
    @Volatile private var generation = 0L
    private var bytes: ByteArray? = null
    private var operation: Job? = null

    private fun clearBytes() { bytes?.fill(0); bytes = null }
    fun close() {
        generation++; operation?.cancel(); operation = null; owner = null
        clearBytes(); mutable.value = ExportState()
    }
    fun open(identity: Identity) {
        close()
        if (identity.role != Role.PATIENT || identity.expiresAt <= Instant.now() || identity.subject.isBlank()) return
        owner = identity; mutable.value = ExportState(ExportStep.IDLE)
    }
    fun download() {
        val identity = owner ?: return
        if (mutable.value.step !in setOf(ExportStep.IDLE, ExportStep.SAVED, ExportStep.CANCELLED, ExportStep.FAILED)) return
        if (identity.expiresAt <= Instant.now()) { close(); return }
        clearBytes(); val current = ++generation
        mutable.value = ExportState(ExportStep.DOWNLOADING)
        operation = scope.launch {
            var received: ByteArray? = null
            try {
                received = service.download(identity)
                coroutineContext.ensureActive()
                requireCurrent(current, identity)
                require(received.isNotEmpty())
                bytes = received.copyOf()
                mutable.value = ExportState(ExportStep.READY)
            } catch (cancelled: CancellationException) {
                if (current == generation) finish(ExportStep.CANCELLED)
                throw cancelled
            } catch (_: Exception) { if (current == generation) finish(ExportStep.FAILED) }
            finally { received?.fill(0) }
        }
    }
    fun selectDestination(): UUID? {
        val identity = owner ?: return null
        if (mutable.value.step != ExportStep.READY) return null
        if (identity.expiresAt <= Instant.now()) { close(); return null }
        val ticket = UUID.randomUUID()
        mutable.value = ExportState(ExportStep.SELECTING, ticket)
        return ticket
    }
    fun cancel(ticket: UUID) {
        if (mutable.value.ticket != ticket) return
        generation++; operation?.cancel(); operation = null; finish(ExportStep.CANCELLED)
    }
    fun save(ticket: UUID, write: suspend (ByteArray, () -> Unit) -> Unit) {
        val identity = owner ?: return
        if (mutable.value != ExportState(ExportStep.SELECTING, ticket)) return
        val payload = bytes?.copyOf() ?: return
        clearBytes(); val current = generation
        mutable.value = ExportState(ExportStep.SAVING, ticket)
        operation = scope.launch {
            try {
                val fresh = sessions.fetch().identity
                coroutineContext.ensureActive()
                requireCurrent(current, identity)
                require(fresh.subject == identity.subject && fresh.role == identity.role && fresh.expiresAt > Instant.now())
                write(payload) {
                    requireCurrent(current, identity)
                    require(fresh.expiresAt > Instant.now())
                }
                coroutineContext.ensureActive()
                requireCurrent(current, identity)
                require(fresh.expiresAt > Instant.now())
                finish(ExportStep.SAVED)
            } catch (cancelled: CancellationException) {
                if (current == generation) finish(ExportStep.CANCELLED)
                throw cancelled
            } catch (_: Exception) { if (current == generation) finish(ExportStep.FAILED) }
            finally { payload.fill(0) }
        }
    }
    private fun requireCurrent(current: Long, identity: Identity) {
        require(generation == current && owner == identity && identity.expiresAt > Instant.now())
    }
    private fun finish(step: ExportStep) { clearBytes(); mutable.value = ExportState(step) }
}
