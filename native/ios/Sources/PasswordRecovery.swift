import Combine
import Foundation

@MainActor
protocol PasswordRecoveryService {
    func requestReset(username: String) async throws -> Bool
    func confirmReset(username: String, password: String, code: String) async throws
}

enum RecoveryStep: Hashable { case closed, request, confirm, complete }
struct RecoveryState: Equatable {
    var step: RecoveryStep = .closed
    var busy = false
    var failed = false
}

@MainActor
final class PasswordRecovery: ObservableObject {
    @Published private(set) var state = RecoveryState()
    private let service: PasswordRecoveryService?
    private var username: String?
    private var operation: Task<Void, Never>?
    private var generation = 0

    init(service: PasswordRecoveryService?) { self.service = service }
    func close() {
        generation += 1
        operation?.cancel()
        operation = nil
        username = nil
        state = RecoveryState()
    }
    func open() {
        close()
        if service != nil { state = RecoveryState(step: .request) }
    }
    func request(_ value: String) {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let service, !trimmed.isEmpty, state.step == .request, !state.busy else { return }
        username = trimmed
        run { [weak self] in
            let complete = try await service.requestReset(username: trimmed)
            try Task.checkCancellation()
            if complete { self?.username = nil }
            self?.state = RecoveryState(step: complete ? .complete : .confirm)
        }
    }
    func confirm(password: String, code: String) {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let service, let username, !password.isEmpty, !trimmed.isEmpty,
              state.step == .confirm, !state.busy else { return }
        run { [weak self] in
            try await service.confirmReset(username: username, password: password, code: trimmed)
            try Task.checkCancellation()
            self?.username = nil
            self?.state = RecoveryState(step: .complete)
        }
    }
    private func run(_ block: @escaping @MainActor () async throws -> Void) {
        generation += 1
        let current = generation
        state.busy = true
        state.failed = false
        operation = Task { [weak self] in
            do { try await block() }
            catch is CancellationError { return }
            catch {
                guard let self, current == generation, !Task.isCancelled else { return }
                state.failed = true
            }
            if let self, current == generation { state.busy = false }
        }
    }
}
