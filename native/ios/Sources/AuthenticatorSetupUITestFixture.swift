#if DEBUG
import Amplify
import Foundation
import SwiftUI

struct AuthenticatorSetupUITestFixture: View {
    let content: MobileContent
    @State private var setup = AuthenticatorSetup.fromSDK(.continueSignInWithTOTPSetup(TOTPSetupDetails(sharedSecret: "test-key", username: "test-user")))
    @State private var visible = true
    @State private var closed = false
    @State private var accepted = false
    @Environment(\.scenePhase) private var phase
    static func requested() -> Bool {
        guard ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.authenticatorSetup),
              let data = try? BundledAssets.data("mobile-config"),
              let config = try? JSONDecoder().decode(ConfigurationDocument.self, from: data), !config.regions.isEmpty else { return false }
        return config.regions.values.allSatisfy {
            $0.awsRegion.isEmpty && $0.userPoolId.isEmpty && $0.clientId.isEmpty && $0.issuer.isEmpty && $0.services.values.allSatisfy(\.isEmpty)
        }
    }
    var body: some View {
        VStack {
            if visible {
                if closed { Text(content.text("signIn")) }
                else {
                    ChallengeResponseView(input: .totpSetup, content: content, busy: false,
                        confirm: { value in accepted = SignInChallenge.response(.totpSetup, value: value) == "123456" },
                        cancel: { setup = nil; closed = true; accepted = false }, setup: setup)
                    if accepted { Text(content.text("code")).accessibilityIdentifier(NativeUITestProtocol.authenticatorCodeAccepted) }
                }
            }
        }.padding().onChange(of: phase) { value in
            if value == .active { visible = true }
            else {
                visible = false; accepted = false
                if !SignInChallenge.retainForAuthenticator(challenge: !closed, input: .totpSetup, setup: setup, busy: false, authenticated: false) {
                    setup = nil; closed = true
                }
            }
        }
    }
}
#endif
