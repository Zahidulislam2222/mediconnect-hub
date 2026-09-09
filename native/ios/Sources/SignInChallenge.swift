import Amplify
import Foundation

enum ChallengeInput: Hashable { case code, password, newPassword }
enum SignInChallenge {
    static func input(_ step: AuthSignInStep) -> ChallengeInput? {
        switch step {
        case .confirmSignInWithSMSMFACode, .confirmSignInWithTOTPCode, .confirmSignInWithOTP: return .code
        case .confirmSignInWithPassword: return .password
        case .confirmSignInWithNewPassword: return .newPassword
        default: return nil
        }
    }
    static func response(_ input: ChallengeInput, value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return input == .code ? trimmed : value
    }
}
