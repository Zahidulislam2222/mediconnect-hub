import Amplify
import AWSCognitoAuthPlugin
import Foundation

enum ChallengeInput: Hashable { case code, password, newPassword, email }
enum SignInChallenge {
    static func choices(_ step: AuthSignInStep) -> [MFAType] {
        switch step {
        case .continueSignInWithMFASelection(let allowed), .continueSignInWithMFASetupSelection(let allowed):
            return [MFAType.totp, .sms, .email].filter { allowed.contains($0) }
        default: return []
        }
    }
    static func selectionResponse(_ choices: [MFAType], value: String) -> String? {
        choices.first { $0.challengeResponse == value }?.challengeResponse
    }
    static func label(_ choice: MFAType) -> String {
        switch choice {
        case .totp: return "mfaAuthenticator"
        case .sms: return "mfaSms"
        case .email: return "mfaEmail"
        }
    }
    static func input(_ step: AuthSignInStep) -> ChallengeInput? {
        switch step {
        case .confirmSignInWithSMSMFACode, .confirmSignInWithTOTPCode, .confirmSignInWithOTP: return .code
        case .confirmSignInWithPassword: return .password
        case .confirmSignInWithNewPassword: return .newPassword
        case .continueSignInWithEmailMFASetup: return .email
        default: return nil
        }
    }
    static func response(_ input: ChallengeInput, value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return input == .code || input == .email ? trimmed : value
    }
}
