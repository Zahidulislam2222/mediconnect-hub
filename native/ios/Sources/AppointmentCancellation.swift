import Combine
import Foundation

@MainActor protocol CancellationService {
    func find(identity: Identity, appointmentId: String) async throws -> Appointment
    func cancel(identity: Identity, appointmentId: String) async throws
}
enum CancellationStep: Hashable { case closed, confirm, processing, confirmed, unconfirmed }
struct CancellationState {
    var step: CancellationStep = .closed
    var appointment: Appointment?
}
@MainActor final class AppointmentCancellation: ObservableObject {
    @Published private(set) var state = CancellationState()
    private let service: CancellationService?
    private let policy: CancellationContract?
    private var identity: Identity?
    private var operation: Task<Void, Never>?
    private var generation = 0
    private var attempted: [String: Set<String>] = [:]
    init(service: CancellationService?, policy: CancellationContract?) { self.service = service; self.policy = policy }
    func close(clearSession: Bool = false) {
        generation += 1; operation?.cancel(); identity = nil; state = CancellationState()
        if clearSession { attempted.removeAll() }
    }
    func open(_ identity: Identity, appointment: Appointment) {
        guard service != nil, policy != nil, identity.role == .patient, !appointment.id.isEmpty else { return }
        close(); self.identity = identity
        state = CancellationState(step: attempted[identity.subject, default: []].contains(appointment.id) ? .unconfirmed : .confirm, appointment: appointment)
    }
    func confirm() { if state.step == .confirm { run(submit: true) } }
    func check() { if state.step == .unconfirmed { run(submit: false) } }
    private func run(submit: Bool) {
        guard let service, let policy, let identity, let selected = state.appointment else { return }
        generation += 1; let current = generation
        state = CancellationState(step: .processing, appointment: selected)
        operation = Task { [weak self] in
            do {
                var latest = try await service.find(identity: identity, appointmentId: selected.id)
                try Task.checkCancellation()
                guard latest.id == selected.id else { throw MobileFailure.response }
                if !policy.cancelledStatuses.contains(latest.status ?? ""), submit {
                    guard policy.cancellableStatuses.contains(latest.status ?? ""), let self,
                          attempted[identity.subject, default: []].insert(selected.id).inserted else { throw MobileFailure.forbidden }
                    try await service.cancel(identity: identity, appointmentId: selected.id)
                    try Task.checkCancellation()
                    latest = try await service.find(identity: identity, appointmentId: selected.id)
                    try Task.checkCancellation()
                }
                guard latest.id == selected.id, policy.cancelledStatuses.contains(latest.status ?? "") else { throw MobileFailure.response }
                if let self, current == generation { state = CancellationState(step: .confirmed, appointment: latest) }
            } catch is CancellationError { return }
            catch {
                if let self, current == generation, !Task.isCancelled { state = CancellationState(step: .unconfirmed, appointment: selected) }
            }
        }
    }
}
