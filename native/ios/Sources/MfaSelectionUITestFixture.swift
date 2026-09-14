#if DEBUG
import Amplify
import AWSCognitoAuthPlugin
import Foundation
import SwiftUI

struct MfaSelectionUITestFixture: View {
    let content: MobileContent
    @State private var choices: [MFAType] = [.totp, .email]
    @State private var closed = false
    @Environment(\.scenePhase) private var phase
    static func requested() -> Bool {
        guard ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.mfaSelection),
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
                ChallengeResponseView(input: .code, content: content,
                    busy: ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.mfaBusy),
                    confirm: { value in
                        if SignInChallenge.selectionResponse(choices, value: value) != nil { choices = [] }
                    }, cancel: { closed = true; choices = [] }, choices: choices)
            }
        }.padding().onChange(of: phase) { value in if value != .active { choices = []; closed = true } }
    }
}
#endif
