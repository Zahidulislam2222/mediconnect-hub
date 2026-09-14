import Combine
import Foundation

@MainActor
protocol RegistrationService {
    func register(username: String, password: String, name: String) async throws -> Bool
    func confirmRegistration(username: String, code: String) async throws -> Bool
    func resendRegistration(username: String) async throws
}

enum RegistrationStep: Hashable { case closed, details, confirm, complete }
struct RegistrationState: Equatable {
    var step: RegistrationStep = .closed
    var accepted = false
    var busy = false
    var failed = false
    var codeRequested = false
}

@MainActor
final class AccountRegistration: ObservableObject {
    @Published private(set) var state = RegistrationState()
    private let service: RegistrationService?
    private var username: String?
    private var operation: Task<Void, Never>?
    private var generation = 0
    init(service: RegistrationService?) { self.service = service }
    func close() {
        generation += 1; operation?.cancel(); operation = nil; username = nil
        state = RegistrationState()
    }
    func open() { close(); if service != nil { state = RegistrationState(step: .details) } }
    func accept(_ value: Bool) {
        if state.step == .details && !state.busy { state.accepted = value }
    }
    func resumeConfirmation(_ value: String) {
        close()
        let value = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if service != nil && !value.isEmpty { username = value; state = RegistrationState(step: .confirm) }
    }
    func register(email: String, password: String, name: String) {
        let subject = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let service, state.step == .details, !state.busy, state.accepted,
              !subject.isEmpty, !name.isEmpty, !password.isEmpty else { return }
        username = subject
        run { [weak self] in
            let complete = try await service.register(username: subject, password: password, name: name)
            try Task.checkCancellation()
            if complete { self?.username = nil }
            self?.state = RegistrationState(step: complete ? .complete : .confirm)
        }
    }
    func confirm(_ code: String) {
        let code = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let service, let username, state.step == .confirm, !state.busy, !code.isEmpty else { return }
        run { [weak self] in
            let complete = try await service.confirmRegistration(username: username, code: code)
            try Task.checkCancellation()
            if complete { self?.username = nil; self?.state = RegistrationState(step: .complete) }
            else { self?.state.failed = true }
        }
    }
    func resend() {
        guard let service, let username, state.step == .confirm, !state.busy else { return }
        run { [weak self] in
            try await service.resendRegistration(username: username)
            try Task.checkCancellation()
            self?.state.codeRequested = true
        }
    }
    private func run(_ block: @escaping @MainActor () async throws -> Void) {
        generation += 1
        let current = generation
        state.busy = true; state.failed = false; state.codeRequested = false
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
