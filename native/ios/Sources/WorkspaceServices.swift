import Amplify
import Foundation

@MainActor protocol WorkspaceSession: PasswordRecoveryService, RegistrationService {
    func signIn(email: String, password: String) async throws -> AuthSignInResult
    func confirm(code: String) async throws -> AuthSignInResult
    func fetch() async throws -> SessionAccess
    func signOut() async
}

protocol WorkspaceAppointments {
    func load(access: SessionAccess, cursor: String?) async throws -> AppointmentPage
}

@MainActor protocol ExplicitSignInLatch: AnyObject {
    var required: Bool { get set }
}

/** Non-sensitive logout preference; credentials remain owned by Amplify/Keychain. */
@MainActor final class StoredSignInLatch: ExplicitSignInLatch {
    private let defaults: UserDefaults
    private let key = "requires-explicit-sign-in"
    init(defaults: UserDefaults) { self.defaults = defaults }
    var required: Bool {
        get { defaults.bool(forKey: key) }
        set { defaults.set(newValue, forKey: key) }
    }
}
