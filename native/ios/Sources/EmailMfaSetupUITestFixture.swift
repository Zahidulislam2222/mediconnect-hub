#if DEBUG
import Foundation
import SwiftUI

struct EmailMfaSetupUITestFixture: View {
    let content: MobileContent
    @State private var input: ChallengeInput = .email
    @State private var closed = false
    @Environment(\.scenePhase) private var phase
    static func requested() -> Bool {
        guard ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.emailMfaSetup),
              let data = try? BundledAssets.data("mobile-config"),
              let config = try? JSONDecoder().decode(ConfigurationDocument.self, from: data), !config.regions.isEmpty else { return false }
        return config.regions.values.allSatisfy {
            $0.awsRegion.isEmpty && $0.userPoolId.isEmpty && $0.clientId.isEmpty && $0.issuer.isEmpty && $0.services.values.allSatisfy(\.isEmpty)
        }
    }
    var body: some View {
        VStack {
            if closed { Text(content.text("signIn")) }
            else {
                ChallengeResponseView(input: input, content: content,
                    busy: ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.emailMfaBusy),
                    confirm: { value in
                        if input == .email && SignInChallenge.response(input, value: value) == "test-user@example.invalid" { input = .code }
                    }, cancel: { closed = true }).id(input)
            }
        }.padding().onChange(of: phase) { value in if value != .active { closed = true } }
    }
}
#endif
