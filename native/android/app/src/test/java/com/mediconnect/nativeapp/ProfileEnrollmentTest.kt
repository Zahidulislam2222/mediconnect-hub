package com.mediconnect.nativeapp

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.yield
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class ProfileEnrollmentTest {
    private val identity = Identity("test-patient", Role.PATIENT, Instant.now().plusSeconds(300))
    private val own = OwnProfile(identity.subject, "Test person", "test-user@example.test")
    private class Fake : ProfileService {
        var reads = 0; var creates = 0
        var read: suspend () -> OwnProfile = { throw ApiFailure(404) }
        var create: suspend () -> Unit = {}
        override suspend fun load(identity: Identity): OwnProfile { reads++; return read() }
        override suspend fun create(identity: Identity, details: ProfileDetails, policyVersion: String) {
            creates++; assertEquals("Test person", details.name); assertEquals("test-user@example.test", details.email)
            assertEquals("test-policy", policyVersion); create()
        }
    }
    private fun submit(model: ProfileEnrollment) = model.submit(" Test person ", " test-user@example.test ", " Test specialty ")
    @Test fun only404AllowsSetupAndExplicitConsentIsRequired() = runBlocking {
        for (status in listOf(null, 401, 403, 410, 429, 500, 503)) {
            val service = Fake(); service.read = { throw ApiFailure(status) }
            val model = ProfileEnrollment(service, "test-policy", this); model.open(identity); yield()
            assertEquals(ProfileStep.FAILED, model.state.value.step); model.accept(true); submit(model); yield()
            assertEquals(0, service.creates); model.close()
        }
        val service = Fake(); val model = ProfileEnrollment(service, "test-policy", this); model.open(identity); yield()
        assertEquals(ProfileStep.MISSING, model.state.value.step); submit(model); yield(); assertEquals(0, service.creates)
        model.close()
    }
    @Test fun setupRechecksBeforeCreateAndReadsBackOwnProfile() = runBlocking {
        val service = Fake(); service.create = { service.read = { own } }
        val model = ProfileEnrollment(service, "test-policy", this); model.open(identity); yield(); model.accept(true)
        submit(model); submit(model); yield()
        assertEquals(1, service.creates); assertEquals(3, service.reads); assertEquals(own, model.state.value.profile); model.close()
    }
    @Test fun existingProfileDuringRecheckNeverCreates() = runBlocking {
        val service = Fake(); val model = ProfileEnrollment(service, "test-policy", this); model.open(identity); yield()
        model.accept(true); service.read = { own }; submit(model); yield()
        assertEquals(ProfileStep.READY, model.state.value.step); assertEquals(0, service.creates); model.close()
    }
    @Test fun conflictRequiresSuccessfulOwnReadback() = runBlocking {
        for (valid in listOf(true, false)) {
            val service = Fake(); service.create = { service.read = { if (valid) own else own.copy(subject = "other-patient") }; throw ApiFailure(409) }
            val model = ProfileEnrollment(service, "test-policy", this); model.open(identity); yield(); model.accept(true); submit(model); yield()
            assertEquals(if (valid) ProfileStep.READY else ProfileStep.FAILED, model.state.value.step); model.close()
        }
    }
    @Test fun unknownCreateOutcomeRequiresExplicitCheckAndFreshConsent() = runBlocking {
        val service = Fake(); service.create = { throw ApiFailure() }
        val model = ProfileEnrollment(service, "test-policy", this); model.open(identity); yield(); model.accept(true); submit(model); yield()
        assertEquals(ProfileStep.FAILED, model.state.value.step); submit(model); yield(); assertEquals(1, service.creates)
        model.check(); yield(); assertFalse(model.state.value.accepted); model.close()
    }
    @Test fun foreignProfileAndUnsupportedRolesCannotCreate() = runBlocking {
        val service = Fake(); service.read = { own.copy(subject = "other-patient") }
        val model = ProfileEnrollment(service, "test-policy", this); model.open(identity); yield()
        assertEquals(ProfileStep.FAILED, model.state.value.step)
        model.open(identity.copy(role = Role.ADMIN)); yield(); assertEquals(ProfileStep.CLOSED, model.state.value.step)
        assertEquals(1, service.reads); model.close()
    }
    @Test fun cancellingPendingReadCannotRestoreProfile() = runBlocking {
        val service = Fake(); val pending = CompletableDeferred<OwnProfile>()
        service.read = { withContext(NonCancellable) { pending.await() } }
        val model = ProfileEnrollment(service, "test-policy", this); model.open(identity); yield(); model.close()
        pending.complete(own); yield(); assertEquals(ProfileState(), model.state.value)
    }
    @Test fun doctorNeedsSpecializationAndNoConfigurationBlocksSetup() = runBlocking {
        val absent = ProfileEnrollment(null, "test-policy", this); absent.open(identity); assertEquals(ProfileStep.CLOSED, absent.state.value.step)
        val service = Fake(); val model = ProfileEnrollment(service, "test-policy", this); model.open(identity.copy(role = Role.DOCTOR)); yield()
        model.accept(true); model.submit("Test person", "test-user@example.test", " "); yield(); assertEquals(0, service.creates); model.close()
    }
}
