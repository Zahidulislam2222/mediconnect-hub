#if DEBUG
import Foundation
import SwiftUI

@MainActor
private final class SyntheticRegistrationService: RegistrationService {
    func register(username: String, password: String, name: String) async throws -> Bool { false }
    func confirmRegistration(username: String, code: String) async throws -> Bool { true }
    func resendRegistration(username: String) async throws {}
}

@MainActor
struct RegistrationUITestFixture: View {
    @StateObject private var model = AccountRegistration(service: SyntheticRegistrationService())
    @Environment(\.scenePhase) private var phase
    let content: MobileContent
    let policies: MobilePolicies
    static func requested() -> Bool {
        guard ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.registration),
              let data = try? BundledAssets.data("mobile-config"),
              let config = try? JSONDecoder().decode(ConfigurationDocument.self, from: data),
              !config.regions.isEmpty else { return false }
        return config.regions.values.allSatisfy {
            $0.awsRegion.isEmpty && $0.userPoolId.isEmpty && $0.clientId.isEmpty && $0.issuer.isEmpty &&
                $0.services.values.allSatisfy(\.isEmpty)
        }
    }
    var body: some View {
        ScrollView {
            if model.state.step == .closed { Button(content.text("createAccount")) { model.open() } }
            else { RegistrationView(model: model, content: content, policies: policies).id(model.state.step) }
        }.padding()
            .onDisappear { model.close() }
            .onChange(of: phase) { value in if value != .active { model.close() } }
    }
}
#endif
