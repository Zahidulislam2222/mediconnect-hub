import Amplify
import Foundation

/// Memory-only enrollment material with redacted diagnostics; deliberately not Codable.
struct AuthenticatorSetup: Equatable, CustomStringConvertible, CustomDebugStringConvertible {
    private let key: String
    private init(key: String) { self.key = key }
    var displayKey: String { key }
    var description: String { "AuthenticatorSetup(redacted)" }
    var debugDescription: String { description }
    static func fromSDK(_ step: AuthSignInStep) -> AuthenticatorSetup? {
        guard case .continueSignInWithTOTPSetup(let details) = step,
              !details.sharedSecret.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return AuthenticatorSetup(key: details.sharedSecret)
    }
}
