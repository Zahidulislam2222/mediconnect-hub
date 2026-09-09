package com.mediconnect.nativeapp

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.amplifyframework.auth.result.AuthSignInResult
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
    val visible: Boolean = true,
)

class WorkspaceModel(application: Application) : AndroidViewModel(application) {
    val content = (application as MediConnectApplication).content
    private val runtime = (application as MediConnectApplication).runtime.getOrNull()
    val configured = runtime != null
    private val mutable = MutableStateFlow(WorkspaceState())
    val state = mutable.asStateFlow()
    private var operation: Job? = null
    private var expiry: Job? = null
    private var generation = 0L

    private fun reset(visible: Boolean = true) {
        generation++
        operation?.cancel()
        expiry?.cancel()
        mutable.value = WorkspaceState(visible = visible)
    }

    fun hide() { reset(visible = false) }

    fun resume() {
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
            completeSignIn(runtime.sessions.signIn(email.trim(), password))
        }
    }

    fun confirm(code: String) {
        val runtime = runtime ?: return
        if (!mutable.value.challenge || code.isBlank() || mutable.value.busy) return
        runOperation("signInFailed") { completeSignIn(runtime.sessions.confirm(code.trim())) }
    }

    private suspend fun completeSignIn(result: AuthSignInResult) {
        val runtime = runtime ?: return
        if (result.isSignedIn) {
            val identity = runtime.sessions.fetch().identity
            runtime.requiresExplicitSignIn = false
            accept(identity)
        } else {
            val supported = SignInChallenge.needsCode(result.nextStep.signInStep)
            mutable.value = mutable.value.copy(challenge = supported, error = if (supported) null else "additionalStep")
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
        if (identity.role in runtime.contract.appointmentQueries) {
            val page = runtime.appointments.load(identity)
            mutable.value = mutable.value.copy(appointments = page.items, next = page.next)
        }
    }

    fun refresh(more: Boolean = false) {
        val runtime = runtime ?: return
        val current = mutable.value
        val identity = current.identity ?: return
        if (current.busy || (more && current.next == null)) return
        runOperation("unavailable") {
            val page = runtime.appointments.load(identity, if (more) current.next else null)
            mutable.value = mutable.value.copy(
                appointments = (if (more) current.appointments + page.items else page.items).distinctBy { it.id },
                next = page.next,
            )
        }
    }

    fun signOut() {
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
