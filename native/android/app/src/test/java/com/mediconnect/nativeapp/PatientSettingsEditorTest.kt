package com.mediconnect.nativeapp

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.yield
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class PatientSettingsEditorTest {
    private val identity = Identity("test-patient", Role.PATIENT, Instant.now().plusSeconds(300))
    private val own = PatientSettingsSnapshot(identity.subject, "Test person", "test@example.test", null, null, null)
    private class Fake(var snapshot: PatientSettingsSnapshot) : PatientSettingsService {
        var writes = 0
        var read: suspend () -> PatientSettingsSnapshot = { snapshot }
        var write: suspend (PatientSettingsDraft) -> Unit = { snapshot = snapshot.copy(name = it.name) }
        override suspend fun load(identity: Identity) = read()
        override suspend fun save(identity: Identity, snapshot: PatientSettingsSnapshot, draft: PatientSettingsDraft) { writes++; write(draft) }
    }
    @Test fun saveRequiresMatchingReadbackAndDuplicateWritesAreBlocked() = runBlocking {
        val service = Fake(own); val model = PatientSettingsEditor(service, 200, this)
        model.open(identity); yield(); model.edit(PatientSettingsDraft(own).copy(name = "Changed"))
        model.save(); model.save(); yield()
        assertEquals(1, service.writes); assertEquals(SettingsStep.SAVED, model.state.value.step)
        assertEquals("Changed", model.state.value.snapshot?.name); model.close()
    }
    @Test fun failedOrMismatchedReadbackRequiresReloadBeforeAnyRetry() = runBlocking {
        for (fails in listOf(true, false)) {
            val service = Fake(own); val model = PatientSettingsEditor(service, 200, this)
            model.open(identity); yield(); model.edit(PatientSettingsDraft(own).copy(name = "Changed"))
            service.write = { if (fails) service.read = { throw ApiFailure(503) } }
            model.save(); yield(); assertEquals(SettingsStep.SAVE_UNCERTAIN, model.state.value.step)
            model.save(); model.discard(); yield(); assertEquals(1, service.writes)
            service.read = { own }; model.reload(); yield(); assertEquals(SettingsStep.EDITING, model.state.value.step)
            model.close()
        }
    }
    @Test fun discardRestoresServerSnapshotAndInvalidNameNeverWrites() = runBlocking {
        val service = Fake(own); val model = PatientSettingsEditor(service, 200, this)
        model.open(identity); yield(); model.edit(PatientSettingsDraft(own).copy(name = " ")); model.save()
        assertTrue(model.state.value.invalid); assertEquals(0, service.writes)
        model.discard(); assertEquals(PatientSettingsDraft(own), model.state.value.draft); model.close()
    }
    @Test fun closingDuringNonCooperativeReadNeverRestoresPrivateState() = runBlocking {
        val result = CompletableDeferred<PatientSettingsSnapshot>()
        val service = Fake(own); service.read = { withContext(NonCancellable) { result.await() } }
        val model = PatientSettingsEditor(service, 200, this); model.open(identity); yield(); model.close()
        result.complete(own); yield(); assertEquals(SettingsState(), model.state.value)
    }
    @Test fun deniedOrForeignProfileCannotBecomeEditable() = runBlocking {
        val service = Fake(own); val model = PatientSettingsEditor(service, 200, this)
        service.read = { throw ApiFailure(403) }; model.open(identity); yield()
        assertEquals(SettingsStep.DENIED, model.state.value.step)
        service.read = { own.copy(subject = "other") }; model.reload(); yield()
        assertEquals(SettingsStep.LOAD_FAILED, model.state.value.step); assertNull(model.state.value.snapshot)
        model.open(identity.copy(role = Role.DOCTOR)); yield(); assertEquals(SettingsState(), model.state.value)
        model.close()
    }
}
