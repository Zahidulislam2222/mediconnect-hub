#if DEBUG
import Foundation
import SwiftUI

struct ChallengeUITestFixture: View {
    let content: MobileContent
    @State private var accepted = false
    @Environment(\.scenePhase) private var phase
    private var input: ChallengeInput {
        ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.existingPassword) ? .password : .newPassword
    }
    static func requested() -> Bool {
        guard ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.passwordChallenge),
              let data = try? BundledAssets.data("mobile-config"),
              let config = try? JSONDecoder().decode(ConfigurationDocument.self, from: data), !config.regions.isEmpty else { return false }
        return config.regions.values.allSatisfy {
            $0.awsRegion.isEmpty && $0.userPoolId.isEmpty && $0.clientId.isEmpty && $0.issuer.isEmpty && $0.services.values.allSatisfy(\.isEmpty)
        }
    }
    var body: some View {
        VStack {
            ChallengeResponseView(input: input, content: content, busy: false, confirm: { value in
                accepted = SignInChallenge.response(input, value: value) == " test-password "
            }, cancel: { accepted = false }).id(phase)
            if accepted { Text(content.text("signIn")).accessibilityIdentifier(NativeUITestProtocol.challengeAccepted) }
        }.padding().onChange(of: phase) { value in if value != .active { accepted = false } }
    }
}
#endif
