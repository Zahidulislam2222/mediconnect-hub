package com.mediconnect.nativeapp

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.amplifyframework.auth.result.AuthSignInResult
import com.amplifyframework.auth.result.step.AuthSignInStep
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant

data class WorkspaceState(
    val identity: Identity? = null,
    val appointments: List<Appointment> = emptyList(),
    val next: String? = null,
    val busy: Boolean = false,
    val error: String? = null,
    val challenge: Boolean = false,
    val challengeInput: ChallengeInput = ChallengeInput.CODE,
    val visible: Boolean = true,
)

class WorkspaceModel(application: Application) : AndroidViewModel(application) {
    val content = (application as MediConnectApplication).content
    val policies = (application as MediConnectApplication).policies
    private val runtime = (application as MediConnectApplication).runtime.getOrNull()
    val configured = runtime != null
    val cancellation = AppointmentCancellation(runtime?.appointments, runtime?.contract?.cancellation, viewModelScope)
    val recovery = PasswordRecovery(runtime?.sessions, viewModelScope)
    val profile = ProfileEnrollment(runtime?.profiles, policies.policyVersion, viewModelScope)
    val registration = AccountRegistration(runtime?.sessions, viewModelScope)
    private val mutable = MutableStateFlow(WorkspaceState())
    val state = mutable.asStateFlow()
    private var operation: Job? = null
    private var expiry: Job? = null
    private var generation = 0L

    init {
        viewModelScope.launch {
            profile.state.collect { value ->
                val identity = mutable.value.identity
                if (value.step == ProfileStep.READY && identity != null && value.profile?.subject == identity.subject) refresh()
            }
        }
    }

    private fun reset(visible: Boolean = true) {
        cancellation.close(clearSession = true)
        profile.close()
        generation++
        operation?.cancel()
        expiry?.cancel()
        mutable.value = WorkspaceState(visible = visible)
    }

    fun hide() { registration.close(); recovery.close(); reset(visible = false) }

    fun openRegistration() {
        val runtime = runtime ?: return
        runtime.requiresExplicitSignIn = true
        recovery.close(); reset(); registration.open()
    }

    fun openRecovery() {
        val runtime = runtime ?: return
        runtime.requiresExplicitSignIn = true
        registration.close()
        reset()
        recovery.open()
    }

    fun resume() {
        if (recovery.state.value.step != RecoveryStep.CLOSED || registration.state.value.step != RegistrationStep.CLOSED) return
        if (mutable.value.visible && (mutable.value.identity != null || mutable.value.busy)) return
        mutable.value = mutable.value.copy(visible = true)
        val runtime = runtime ?: return
        if (runtime.requiresExplicitSignIn) return
        runOperation("sessionExpired") { accept(runtime.sessions.fetch().identity) }
    }

    fun signIn(email: String, password: String) {
        val runtime = runtime ?: return
        if (email.isBlank() || password.isEmpty() || mutable.value.busy) return
        runtime.requiresExplicitSignIn = true
        runOperation("signInFailed") {
            runtime.sessions.signOut()
            val result = runtime.sessions.signIn(email.trim(), password)
            if (result.nextStep.signInStep == AuthSignInStep.CONFIRM_SIGN_UP) registration.resumeConfirmation(email)
            else completeSignIn(result)
        }
    }

    fun confirm(code: String) {
        val runtime = runtime ?: return
        if (!mutable.value.challenge || code.isBlank() || mutable.value.busy) return
        val response = SignInChallenge.response(mutable.value.challengeInput, code) ?: return
        runOperation("signInFailed") { completeSignIn(runtime.sessions.confirm(response)) }
    }

    private suspend fun completeSignIn(result: AuthSignInResult) {
        val runtime = runtime ?: return
        if (result.isSignedIn) {
            val identity = runtime.sessions.fetch().identity
            runtime.requiresExplicitSignIn = false
            accept(identity)
        } else {
            val input = SignInChallenge.input(result.nextStep.signInStep)
            mutable.value = mutable.value.copy(challenge = input != null, challengeInput = input ?: ChallengeInput.CODE, error = if (input != null) null else "additionalStep")
        }
    }

    private suspend fun accept(identity: Identity) {
        val runtime = runtime ?: return
        mutable.value = WorkspaceState(identity = identity, busy = true)
        expiry?.cancel()
        expiry = viewModelScope.launch {
            delay(Duration.between(Instant.now(), identity.expiresAt).toMillis().coerceAtLeast(0))
            reset()
            mutable.value = mutable.value.copy(error = "sessionExpired")
        }
        profile.open(identity)

    }

    fun refresh(more: Boolean = false) {
        val runtime = runtime ?: return
        val current = mutable.value
        val identity = current.identity ?: return
        if (current.busy || profile.state.value.step != ProfileStep.READY || (more && current.next == null)) return
        runOperation("unavailable") {
            val page = runtime.appointments.load(identity, if (more) current.next else null)
            mutable.value = mutable.value.copy(
                appointments = (if (more) current.appointments + page.items else page.items).distinctBy { it.id },
                next = page.next,
            )
        }
    }

    fun openCancellation(appointment: Appointment) {
        val current = mutable.value
        val identity = current.identity ?: return
        if (current.busy || profile.state.value.step != ProfileStep.READY || current.appointments.none { it.id == appointment.id }) return
        cancellation.open(identity, appointment)
    }
    fun closeCancellation() {
        val confirmed = cancellation.state.value.step == CancellationStep.CONFIRMED
        cancellation.close()
        if (confirmed) refresh()
    }

    fun signOut() {
        registration.close()
        recovery.close()
        val runtime = runtime ?: return
        runtime.requiresExplicitSignIn = true
        reset()
        runOperation("signInFailed") { runtime.sessions.signOut() }
    }

    private fun runOperation(error: String, block: suspend () -> Unit) {
        operation?.cancel()
        val current = ++generation
        mutable.value = mutable.value.copy(busy = true, error = null)
        operation = viewModelScope.launch {
            try { block() }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (failure: Exception) {
                if (current == generation) {
                    val authFailed = failure is ApiFailure && failure.status == 401
                    if (authFailed) mutable.value = WorkspaceState(error = "sessionExpired")
                    else mutable.value = mutable.value.copy(error = when {
                        failure is ApiFailure && failure.status == 403 -> "accessDenied"
                        mutable.value.identity != null -> "unavailable"
                        else -> error
                    })
                }
            } finally {
                if (current == generation) mutable.value = mutable.value.copy(busy = false)
            }
        }
    }
}
