// Stable launch protocol shared by the app's DEBUG-only fixture and its UI test target.
enum NativeUITestProtocol {
    static let authenticatorSetup = "--native-authenticator-setup-ui-test"
    static let authenticatorCodeAccepted = "native-authenticator-code-accepted"
    static let emailMfaSetup = "--native-email-mfa-setup-ui-test"
    static let emailMfaBusy = "--native-email-mfa-busy"
    static let mfaSelection = "--native-mfa-selection-ui-test"
    static let mfaBusy = "--native-mfa-busy"
    static let cancellation = "--native-cancellation-ui-test"
    static let cancellationLostResponse = "--native-cancellation-lost-response"
    static let passwordChallenge = "--native-password-challenge-ui-test"
    static let existingPassword = "--native-existing-password-ui-test"
    static let challengeAccepted = "native-challenge-accepted"
    static let profile = "--native-profile-ui-test"
    static let profileFailure = "--native-profile-failure-ui-test"
    static let passwordRecovery = "--native-password-recovery-ui-test"
    static let registration = "--native-registration-ui-test"
}
