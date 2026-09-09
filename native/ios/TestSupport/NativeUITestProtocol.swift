// Stable launch protocol shared by the app's DEBUG-only fixture and its UI test target.
enum NativeUITestProtocol {
    static let passwordChallenge = "--native-password-challenge-ui-test"
    static let existingPassword = "--native-existing-password-ui-test"
    static let challengeAccepted = "native-challenge-accepted"
    static let profile = "--native-profile-ui-test"
    static let profileFailure = "--native-profile-failure-ui-test"
    static let passwordRecovery = "--native-password-recovery-ui-test"
    static let registration = "--native-registration-ui-test"
}
