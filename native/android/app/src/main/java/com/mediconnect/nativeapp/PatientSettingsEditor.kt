package com.mediconnect.nativeapp

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import kotlin.coroutines.coroutineContext

enum class SettingsStep { CLOSED, LOADING, EDITING, SAVING, SAVED, LOAD_FAILED, SAVE_UNCERTAIN, DENIED, MISSING }
data class SettingsState(val step: SettingsStep = SettingsStep.CLOSED, val snapshot: PatientSettingsSnapshot? = null,
                         val draft: PatientSettingsDraft? = null, val invalid: Boolean = false) {
    val busy get() = step == SettingsStep.LOADING || step == SettingsStep.SAVING
    val editable get() = step == SettingsStep.EDITING || step == SettingsStep.SAVED
}

class PatientSettingsEditor(private val service: PatientSettingsService, private val maxNameLength: Int,
                            private val scope: CoroutineScope) {
    private val mutable = MutableStateFlow(SettingsState())
    val state = mutable.asStateFlow()
    private var identity: Identity? = null
    private var operation: Job? = null
    private var generation = 0
    fun close() { generation++; operation?.cancel(); operation = null; identity = null; mutable.value = SettingsState() }
    fun open(value: Identity) {
        close()
        if (value.role != Role.PATIENT || value.expiresAt <= Instant.now()) return
        identity = value; reload()
    }
    fun edit(draft: PatientSettingsDraft) {
        if (mutable.value.editable) mutable.value = mutable.value.copy(step = SettingsStep.EDITING,
            draft = draft.copy(preferences = draft.preferences?.toMap()), invalid = false)
    }
    fun discard() {
        val current = mutable.value
        if (current.editable && current.snapshot != null) mutable.value = current.copy(step = SettingsStep.EDITING,
            draft = PatientSettingsDraft(current.snapshot), invalid = false)
    }
    fun reload() {
        val owner = identity ?: return
        if (mutable.value.busy) return
        val current = ++generation
        mutable.value = SettingsState(SettingsStep.LOADING)
        operation = scope.launch {
            try {
                val snapshot = service.load(owner)
                coroutineContext.ensureActive()
                if (current != generation) return@launch
                require(snapshot.subject == owner.subject)
                mutable.value = SettingsState(SettingsStep.EDITING, snapshot, PatientSettingsDraft(snapshot))
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (failure: Exception) { if (current == generation) mutable.value = SettingsState(readFailure(failure)) }
        }
    }
    fun save() {
        val owner = identity ?: return
        val before = mutable.value
        val snapshot = before.snapshot ?: return
        val draft = before.draft ?: return
        if (!before.editable) return
        val changes = try { PatientSettingsData.changes(snapshot, draft, maxNameLength) }
        catch (_: Exception) { mutable.value = before.copy(invalid = true); return }
        if (changes.length() == 0) return
        val current = ++generation
        mutable.value = before.copy(step = SettingsStep.SAVING, invalid = false)
        operation = scope.launch {
            try {
                service.save(owner, snapshot, draft)
                coroutineContext.ensureActive()
                if (current != generation) return@launch
                val saved = service.load(owner)
                coroutineContext.ensureActive()
                if (current != generation) return@launch
                require(saved.subject == owner.subject)
                require(draft.name == snapshot.name || saved.name == draft.name)
                require(draft.phone == snapshot.phone || saved.phone == draft.phone)
                require(draft.address == snapshot.address || saved.address == draft.address)
                require(draft.preferences == snapshot.preferences || saved.preferences == draft.preferences)
                mutable.value = SettingsState(SettingsStep.SAVED, saved, PatientSettingsDraft(saved))
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (failure: Exception) {
                if (current == generation) mutable.value = if (failure is ApiFailure && failure.status in setOf(401, 403))
                    SettingsState(SettingsStep.DENIED) else before.copy(step = SettingsStep.SAVE_UNCERTAIN)
            }
        }
    }
    private fun readFailure(failure: Exception) = when ((failure as? ApiFailure)?.status) {
        401, 403 -> SettingsStep.DENIED
        404 -> SettingsStep.MISSING
        else -> SettingsStep.LOAD_FAILED
    }
}
