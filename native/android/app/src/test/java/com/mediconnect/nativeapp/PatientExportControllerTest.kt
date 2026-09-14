package com.mediconnect.nativeapp

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.yield
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class PatientExportControllerTest {
    private val owner = Identity("test-patient", Role.PATIENT, Instant.MAX)
    private class Fake : PatientExportService, SessionProvider {
        var current = Identity("test-patient", Role.PATIENT, Instant.MAX)
        var downloads = 0
        var read: suspend () -> ByteArray = { byteArrayOf(1, 2, 3) }
        override suspend fun download(identity: Identity): ByteArray { downloads++; return read() }
        override suspend fun fetch() = SessionAccess(current, "test-token")
    }
    @Test fun oneDownloadAndOneUserSelectedWritePreserveBytes() = runBlocking {
        val service = Fake(); val model = PatientExportController(service, service, this)
        model.open(owner); model.download(); model.download(); yield()
        assertEquals(1, service.downloads); assertEquals(ExportStep.READY, model.state.value.step)
        val ticket = model.selectDestination()!!; assertNull(model.selectDestination())
        var writes = 0
        val write: suspend (ByteArray, () -> Unit) -> Unit = { bytes, valid -> valid(); assertArrayEquals(byteArrayOf(1, 2, 3), bytes); writes++ }
        model.save(ticket, write); model.save(ticket, write); yield()
        assertEquals(1, writes); assertEquals(ExportStep.SAVED, model.state.value.step); model.close()
    }
    @Test fun closedNoncooperativeDownloadCannotRestoreData() = runBlocking {
        val delayed = CompletableDeferred<ByteArray>(); val service = Fake()
        service.read = { withContext(NonCancellable) { delayed.await() } }
        val model = PatientExportController(service, service, this)
        model.open(owner); model.download(); yield(); model.close()
        delayed.complete(byteArrayOf(1, 2, 3)); yield()
        assertEquals(ExportState(), model.state.value); assertNull(model.selectDestination())
    }
    @Test fun cancelledAndOldPickerCallbacksNeverWrite() = runBlocking {
        val service = Fake(); val model = PatientExportController(service, service, this)
        model.open(owner); model.download(); yield(); val old = model.selectDestination()!!
        model.cancel(old); model.save(old) { _, _ -> fail("Cancelled picker wrote") }; yield()
        assertEquals(ExportStep.CANCELLED, model.state.value.step)
        model.download(); yield(); val current = model.selectDestination()!!
        model.cancel(old); model.save(old) { _, _ -> fail("Stale picker wrote") }
        assertEquals(current, model.state.value.ticket)
        model.close(); model.save(current) { _, _ -> fail("Closed picker wrote") }; yield()
        assertEquals(ExportState(), model.state.value)
    }
    @Test fun changedSessionOrWriteFailureCannotClaimSaved() = runBlocking {
        for (changed in listOf(true, false)) {
            val service = Fake(); val model = PatientExportController(service, service, this)
            model.open(owner); model.download(); yield(); val ticket = model.selectDestination()!!
            if (changed) service.current = owner.copy(subject = "other-patient")
            var writes = 0
            model.save(ticket) { _, _ -> writes++; throw java.io.IOException("test-write-failure") }; yield()
            assertEquals(if (changed) 0 else 1, writes)
            assertEquals(ExportStep.FAILED, model.state.value.step); model.close()
        }
    }
    @Test fun closeInvalidatesWriterGuardAndSuppressesLateSuccess() = runBlocking {
        val service = Fake(); val model = PatientExportController(service, service, this)
        model.open(owner); model.download(); yield(); val ticket = model.selectDestination()!!
        val release = CompletableDeferred<Unit>(); var guard: (() -> Unit)? = null
        model.save(ticket) { _, valid -> guard = valid; withContext(NonCancellable) { release.await() } }; yield()
        model.close(); assertThrows(IllegalArgumentException::class.java) { guard!!() }
        release.complete(Unit); yield(); assertEquals(ExportState(), model.state.value)
    }
    @Test fun invalidIdentityAndEmptyResultCannotStartHandoff() = runBlocking {
        val service = Fake(); val model = PatientExportController(service, service, this)
        for (invalid in listOf(owner.copy(role = Role.DOCTOR), owner.copy(expiresAt = Instant.EPOCH))) {
            model.open(invalid); model.download(); yield(); assertEquals(ExportState(), model.state.value)
        }
        service.read = { byteArrayOf() }; model.open(owner); model.download(); yield()
        assertEquals(ExportStep.FAILED, model.state.value.step); assertNull(model.selectDestination()); model.close()
    }
}
