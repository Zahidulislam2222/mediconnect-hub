#if DEBUG
import Foundation
import SwiftUI

@MainActor
private final class SyntheticRecoveryService: PasswordRecoveryService {
    func requestReset(username: String) async throws -> Bool { false }
    func confirmReset(username: String, password: String, code: String) async throws {}
}

@MainActor
struct RecoveryUITestFixture: View {
    @StateObject private var recovery = PasswordRecovery(service: SyntheticRecoveryService())
    @Environment(\.scenePhase) private var phase
    let content: MobileContent
    static func requested() -> Bool {
        guard ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.passwordRecovery),
              let data = try? BundledAssets.data("mobile-config"),
              let config = try? JSONDecoder().decode(ConfigurationDocument.self, from: data),
              !config.regions.isEmpty else { return false }
        // This fixture can never be used with a configured provider or real account.
        return config.regions.values.allSatisfy {
            $0.awsRegion.isEmpty && $0.userPoolId.isEmpty && $0.clientId.isEmpty && $0.issuer.isEmpty &&
                $0.services.values.allSatisfy(\.isEmpty)
        }
    }
    var body: some View {
        ScrollView {
            if recovery.state.step == .closed {
                Button(content.text("forgotPassword")) { recovery.open() }
            } else { RecoveryView(model: recovery, content: content).id(recovery.state.step) }
        }
        .padding()
        .onDisappear { recovery.close() }
        .onChange(of: phase) { value in if value != .active { recovery.close() } }
    }
}
#endif
