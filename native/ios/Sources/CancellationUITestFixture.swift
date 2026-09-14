#if DEBUG
import Foundation
import SwiftUI

@MainActor
private final class SyntheticCancellationService: CancellationService {
    var cancelled = false
    let loseResponse: Bool
    init(loseResponse: Bool) { self.loseResponse = loseResponse }
    func find(identity: Identity, appointmentId: String) async throws -> Appointment {
        Appointment(id: appointmentId, time: nil, person: "Test doctor", status: cancelled ? "CANCELLED" : "CONFIRMED")
    }
    func cancel(identity: Identity, appointmentId: String) async throws {
        cancelled = true; if loseResponse { throw HTTPFailure(status: nil) }
    }
}

@MainActor
struct CancellationUITestFixture: View {
    @StateObject private var model: AppointmentCancellation
    init(content: MobileContent) {
        self.content = content
        let policy = try? MobileContract(data: BundledAssets.data("mobile-contract"), policy: BundledAssets.data("session-policy"))
        _model = StateObject(wrappedValue: AppointmentCancellation(
            service: SyntheticCancellationService(loseResponse: ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.cancellationLostResponse)),
            policy: policy?.cancellation))
    }
    @Environment(\.scenePhase) private var phase
    let content: MobileContent
    static func requested() -> Bool {
        guard ProcessInfo.processInfo.arguments.contains(NativeUITestProtocol.cancellation),
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
            if model.state.step == .closed {
                Button(content.text("cancelAppointment")) {
                    model.open(Identity(subject: "test-patient", role: .patient, expiresAt: Date().addingTimeInterval(300)),
                               appointment: Appointment(id: "test-appointment", time: nil, person: "Test doctor", status: "CONFIRMED"))
                }
            } else { CancellationView(model: model, content: content, close: { model.close() }) }
        }.padding()
            .onDisappear { model.close() }
            .onChange(of: phase) { value in if value != .active { model.close() } }
    }
}
#endif
