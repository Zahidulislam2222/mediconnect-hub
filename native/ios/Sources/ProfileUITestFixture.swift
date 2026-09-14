#if DEBUG
import Foundation
import SwiftUI

@MainActor private final class SyntheticProfileService: ProfileService {
    let fail: Bool
    var created = false
    init(fail: Bool) { self.fail = fail }
    func load(identity: Identity) async throws -> OwnProfile {
        guard created && !fail else { throw HTTPFailure(status: 404) }
        return OwnProfile(subject: identity.subject, name: "Test person", email: "test-user@example.test")
    }
    func create(identity: Identity, details: ProfileDetails, policyVersion: String) async throws {
        if fail { throw HTTPFailure(status: nil) }; created = true
    }
}
@MainActor struct ProfileUITestFixture: View {
    @StateObject private var model: ProfileEnrollment
    @Environment(\.scenePhase) private var phase
    let content: MobileContent
    let policies: MobilePolicies
    init(content: MobileContent, policies: MobilePolicies) {
        self.content = content; self.policies = policies
        _model = StateObject(wrappedValue: ProfileEnrollment(
            service: SyntheticProfileService(fail: ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.profileFailure)),
            policyVersion: policies.policyVersion))
    }
    static func requested() -> Bool {
        guard ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.profile),
              let data = try? BundledAssets.data("mobile-config"),
              let config = try? JSONDecoder().decode(ConfigurationDocument.self, from: data),
              !config.regions.isEmpty else { return false }
        return config.regions.values.allSatisfy {
            $0.awsRegion.isEmpty && $0.userPoolId.isEmpty && $0.clientId.isEmpty && $0.issuer.isEmpty && $0.services.values.allSatisfy(\.isEmpty)
        }
    }
    var body: some View {
        ScrollView {
            if model.state.step == .ready { Text(content.text("appointments")) }
            else { ProfileSetupView(model: model, role: .patient, content: content, policies: policies).id(model.state.step) }
        }.padding().onAppear { model.open(Identity(subject: "test-patient", role: .patient, expiresAt: Date().addingTimeInterval(300))) }
            .onDisappear { model.close() }
            .onChange(of: phase) { value in if value != .active { model.close() } }
    }
}
#endif
