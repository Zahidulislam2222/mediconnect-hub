import Amplify
import AWSCognitoAuthPlugin
import Foundation

final class CognitoSession {
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
}
