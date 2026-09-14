#if DEBUG
import Foundation
import SwiftUI

@MainActor private final class SyntheticPatientSettingsService: PatientSettingsService {
    private var saved = PatientSettingsSnapshot(subject: "test-patient", name: "Test Patient", email: "test@example.invalid",
                                                phone: nil, address: nil, preferences: nil)
    private let loseReadback: Bool
    private var pendingReadbackFailure = false
    init(loseReadback: Bool) { self.loseReadback = loseReadback }
    func load(identity: Identity) async throws -> PatientSettingsSnapshot {
        guard identity.subject == saved.subject else { throw MobileFailure.forbidden }
        if pendingReadbackFailure { pendingReadbackFailure = false; throw HTTPFailure(status: nil) }
        return saved
    }
    func save(identity: Identity, snapshot: PatientSettingsSnapshot, draft: PatientSettingsDraft) async throws {
        guard identity.subject == saved.subject, snapshot.subject == saved.subject else { throw MobileFailure.forbidden }
        saved = PatientSettingsSnapshot(subject: saved.subject, name: draft.name, email: saved.email,
                                         phone: draft.phone, address: draft.address, preferences: draft.preferences)
        pendingReadbackFailure = loseReadback
    }
}

@MainActor struct PatientSettingsUITestFixture: View {
    @StateObject private var model: PatientSettingsEditor
    @Environment(\.scenePhase) private var phase
    let content: MobileContent
    init(content: MobileContent, contract: MobileContract) {
        self.content = content
        _model = StateObject(wrappedValue: PatientSettingsEditor(service: SyntheticPatientSettingsService(
            loseReadback: ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.patientSettingsLostReadback)),
            maxNameLength: contract.patientSettings.maxNameLength))
    }
    static func requested() -> Bool {
        guard ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.patientSettings),
              let data = try? BundledAssets.data("mobile-config"),
              let config = try? JSONDecoder().decode(ConfigurationDocument.self, from: data),
              !config.regions.isEmpty else { return false }
        return config.regions.values.allSatisfy {
            $0.awsRegion.isEmpty && $0.userPoolId.isEmpty && $0.clientId.isEmpty && $0.issuer.isEmpty && $0.services.values.allSatisfy(\.isEmpty)
        }
    }
    var body: some View {
        PatientSettingsEntry(model: model, content: content, busy: false, open: {
            model.open(Identity(subject: "test-patient", role: .patient, expiresAt: Date().addingTimeInterval(300)))
        }).padding()
            .onDisappear { model.close() }
            .onChange(of: phase) { value in if value != .active { model.close() } }
    }
}
#endif
