package com.mediconnect.nativeapp

import com.amplifyframework.auth.result.AuthSignInResult

interface SignInSession : SessionProvider, PasswordRecoveryService, RegistrationService {
    suspend fun signIn(email: String, password: String): AuthSignInResult
    suspend fun confirm(code: String): AuthSignInResult
    suspend fun signOut()
}

interface WorkspaceAppointments : CancellationService {
    suspend fun load(identity: Identity, cursor: String? = null): AppointmentPage
}

/** Dependencies used by the production workspace; composition remains in MobileRuntime. */
interface WorkspaceServices {
    val sessions: SignInSession
    val profiles: ProfileService
    val appointments: WorkspaceAppointments
    val contract: MobileContract
    var requiresExplicitSignIn: Boolean
}
