import Amplify
import AWSCognitoAuthPlugin
import AWSPluginsCore
import Foundation

final class CognitoSession: PasswordRecoveryService {
    private let config: MobileConfiguration
    private let contract: MobileContract
    init(config: MobileConfiguration, contract: MobileContract) throws {
        self.config = config
        self.contract = contract
        let outputs = AmplifyOutputsData(auth: .init(awsRegion: config.region.awsRegion,
            userPoolId: config.region.userPoolId, userPoolClientId: config.region.clientId))
        try Amplify.add(plugin: AWSCognitoAuthPlugin())
        try Amplify.configure(outputs)
    }
    func fetch() async throws -> SessionAccess {
        let session = try await Amplify.Auth.fetchAuthSession()
        guard session.isSignedIn, let provider = session as? AuthCognitoTokensProvider else { throw MobileFailure.session }
        let tokens = try provider.getCognitoTokens().get()
        return try SessionClaims.fromSDKToken(tokens.idToken, config: config, contract: contract, now: Date())
    }
    func signIn(email: String, password: String) async throws -> AuthSignInResult {
        try await Amplify.Auth.signIn(username: email, password: password)
    }
    func confirm(code: String) async throws -> AuthSignInResult { try await Amplify.Auth.confirmSignIn(challengeResponse: code) }
    func signOut() async { _ = await Amplify.Auth.signOut() }
    func requestReset(username: String) async throws -> Bool {
        let result = try await Amplify.Auth.resetPassword(for: username)
        switch result.nextStep {
        case .done: return true
        case .confirmResetPasswordWithCode: return false
        }
    }
    func confirmReset(username: String, password: String, code: String) async throws {
        try await Amplify.Auth.confirmResetPassword(for: username, with: password, confirmationCode: code)
    }
}
