package com.mediconnect.nativeapp

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.yield
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class AppointmentCancellationTest {
    private val identity = Identity("test-patient", Role.PATIENT, Instant.now().plusSeconds(300))
    private val appointment = Appointment("test-appointment", null, "Test doctor", "CONFIRMED")
    private val policy = CancellationContract("/test-cancel", setOf("CONFIRMED"), setOf("CANCELLED"), 3)
    private class Fake(var appointment: Appointment) : CancellationService {
        var reads = 0; var posts = 0
        var read: suspend () -> Appointment = { appointment }
        var post: suspend () -> Unit = { appointment = appointment.copy(status = "CANCELLED") }
        override suspend fun find(identity: Identity, appointmentId: String): Appointment { reads++; return read() }
        override suspend fun cancel(identity: Identity, appointmentId: String) { posts++; post() }
    }
    @Test fun explicitConfirmationAndPatientConfigurationRequired() = runBlocking {
        val service = Fake(appointment); val model = AppointmentCancellation(service, policy, this)
        model.open(identity.copy(role = Role.DOCTOR), appointment); model.confirm(); yield()
        assertEquals(CancellationStep.CLOSED, model.state.value.step)
        model.open(identity, appointment); model.close(); model.confirm(); yield(); assertEquals(0, service.posts); assertEquals(0, service.reads)
        val absent = AppointmentCancellation(null, policy, this); absent.open(identity, appointment)
        assertEquals(CancellationStep.CLOSED, absent.state.value.step)
    }
    @Test fun confirmsOnceOnlyAfterReadbackAndBlocksDuplicate() = runBlocking {
        val service = Fake(appointment); val model = AppointmentCancellation(service, policy, this)
        model.open(identity, appointment); model.confirm(); model.confirm(); yield()
        assertEquals(1, service.posts); assertEquals(2, service.reads); assertEquals(CancellationStep.CONFIRMED, model.state.value.step); model.close()
    }
    @Test fun alreadyCancelledNeverPosts() = runBlocking {
        val service = Fake(appointment.copy(status = "CANCELLED")); val model = AppointmentCancellation(service, policy, this)
        model.open(identity, appointment); model.confirm(); yield()
        assertEquals(0, service.posts); assertEquals(CancellationStep.CONFIRMED, model.state.value.step); model.close()
    }
    @Test fun missingForbiddenAndForeignReadNeverPosts() = runBlocking {
        for (status in listOf(401, 403, 404, 500)) {
            val service = Fake(appointment); service.read = { throw ApiFailure(status) }
            val model = AppointmentCancellation(service, policy, this); model.open(identity, appointment); model.confirm(); yield()
            assertEquals(0, service.posts); assertEquals(CancellationStep.UNCONFIRMED, model.state.value.step); model.close()
        }
        val service = Fake(appointment.copy(id = "other-appointment")); val model = AppointmentCancellation(service, policy, this)
        model.open(identity, appointment); model.confirm(); yield(); assertEquals(0, service.posts); model.close()
    }
    @Test fun nonCancellableAndMissingStatusNeverPost() = runBlocking {
        for (status in listOf(null, "IN_PROGRESS", "COMPLETED", "UNKNOWN")) {
            val service = Fake(appointment.copy(status = status)); val model = AppointmentCancellation(service, policy, this)
            model.open(identity, appointment); model.confirm(); yield(); assertEquals(0, service.posts); model.close()
        }
    }
    @Test fun acknowledgementWithoutCancelledReadbackIsUnconfirmed() = runBlocking {
        val service = Fake(appointment); service.post = {}
        val model = AppointmentCancellation(service, policy, this); model.open(identity, appointment); model.confirm(); yield()
        assertEquals(CancellationStep.UNCONFIRMED, model.state.value.step); model.confirm(); model.check(); yield()
        assertEquals(1, service.posts); model.close(); model.open(identity, appointment); model.confirm(); yield()
        assertEquals(CancellationStep.UNCONFIRMED, model.state.value.step); assertEquals(1, service.posts); model.close()
    }
    @Test fun lostResponseCanBeResolvedByReadOnlyCheck() = runBlocking {
        val service = Fake(appointment); service.post = { service.appointment = appointment.copy(status = "CANCELLED"); throw ApiFailure() }
        val model = AppointmentCancellation(service, policy, this); model.open(identity, appointment); model.confirm(); yield()
        assertEquals(CancellationStep.UNCONFIRMED, model.state.value.step); model.check(); yield()
        assertEquals(CancellationStep.CONFIRMED, model.state.value.step); assertEquals(1, service.posts); model.close()
    }
    @Test fun closeDuringNonCancellableReadCannotPostOrRestoreData() = runBlocking {
        val service = Fake(appointment); val pending = CompletableDeferred<Appointment>()
        service.read = { withContext(NonCancellable) { pending.await() } }
        val model = AppointmentCancellation(service, policy, this); model.open(identity, appointment); model.confirm(); yield(); model.close()
        pending.complete(appointment); yield(); assertEquals(CancellationState(), model.state.value); assertEquals(0, service.posts)
    }
}
