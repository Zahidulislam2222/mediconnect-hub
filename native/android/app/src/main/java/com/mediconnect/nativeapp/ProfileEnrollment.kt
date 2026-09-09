package com.mediconnect.nativeapp

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.coroutines.coroutineContext

data class OwnProfile(val subject: String, val name: String, val email: String)
data class ProfileDetails(val name: String, val email: String, val specialization: String)
interface ProfileService {
    suspend fun load(identity: Identity): OwnProfile
    suspend fun create(identity: Identity, details: ProfileDetails, policyVersion: String)
}
enum class ProfileStep { CLOSED, CHECKING, MISSING, READY, FAILED }
data class ProfileState(val step: ProfileStep = ProfileStep.CLOSED, val profile: OwnProfile? = null,
                        val accepted: Boolean = false, val busy: Boolean = false)

class ProfileEnrollment(private val service: ProfileService?, private val policyVersion: String,
                        private val scope: CoroutineScope) {
    private val mutable = MutableStateFlow(ProfileState())
    val state = mutable.asStateFlow()
    private var identity: Identity? = null
    private var operation: Job? = null
    private var generation = 0
    fun close() { generation++; operation?.cancel(); identity = null; mutable.value = ProfileState() }
    fun open(value: Identity) {
        close()
        if (service == null || value.role !in setOf(Role.PATIENT, Role.DOCTOR)) return
        identity = value; check()
    }
    fun accept(value: Boolean) {
        if (mutable.value.step == ProfileStep.MISSING && !mutable.value.busy) mutable.value = mutable.value.copy(accepted = value)
    }
    fun check() {
        val identity = identity ?: return
        val service = service ?: return
        if (mutable.value.busy) return
        run {
            mutable.value = ProfileState(ProfileStep.CHECKING, busy = true)
            val profile = readMissing(service, identity)
            mutable.value = if (profile == null) ProfileState(ProfileStep.MISSING) else ProfileState(ProfileStep.READY, profile)
        }
    }
    fun submit(name: String, email: String, specialization: String) {
        val identity = identity ?: return
        val service = service ?: return
        val details = ProfileDetails(name.trim(), email.trim(), specialization.trim())
        if (mutable.value.step != ProfileStep.MISSING || !mutable.value.accepted || mutable.value.busy || policyVersion.isBlank()
            || details.name.isBlank() || details.email.isBlank() || (identity.role == Role.DOCTOR && details.specialization.isBlank())) return
        run {
            val existing = readMissing(service, identity)
            if (existing != null) { mutable.value = ProfileState(ProfileStep.READY, existing); return@run }
            try { service.create(identity, details, policyVersion) }
            catch (failure: ApiFailure) { if (failure.status != 409) throw failure }
            coroutineContext.ensureActive()
            val profile = service.load(identity)
            coroutineContext.ensureActive()
            require(profile.subject == identity.subject)
            mutable.value = ProfileState(ProfileStep.READY, profile)
        }
    }
    private suspend fun readMissing(service: ProfileService, identity: Identity): OwnProfile? {
        val profile = try { service.load(identity) } catch (failure: ApiFailure) {
            if (failure.status != 404) throw failure
            null
        }
        coroutineContext.ensureActive()
        require(profile == null || profile.subject == identity.subject)
        return profile
    }
    private fun run(block: suspend () -> Unit) {
        val current = ++generation
        mutable.value = mutable.value.copy(busy = true)
        operation = scope.launch {
            try { block() }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { if (current == generation) mutable.value = ProfileState(ProfileStep.FAILED) }
            finally { if (current == generation) mutable.value = mutable.value.copy(busy = false) }
        }
    }
}
