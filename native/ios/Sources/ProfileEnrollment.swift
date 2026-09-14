import Combine
import Foundation

struct OwnProfile: Equatable { let subject: String; let name: String; let email: String }
struct ProfileDetails { let name: String; let email: String; let specialization: String }
@MainActor protocol ProfileService {
    func load(identity: Identity) async throws -> OwnProfile
    func create(identity: Identity, details: ProfileDetails, policyVersion: String) async throws
}
enum ProfileStep: Hashable { case closed, checking, missing, ready, failed }
struct ProfileState: Equatable {
    var step: ProfileStep = .closed
    var profile: OwnProfile?
    var accepted = false
    var busy = false
}
@MainActor final class ProfileEnrollment: ObservableObject {
    @Published private(set) var state = ProfileState()
    private let service: ProfileService?
    private let policyVersion: String
    private var identity: Identity?
    private var operation: Task<Void, Never>?
    private var generation = 0
    init(service: ProfileService?, policyVersion: String) { self.service = service; self.policyVersion = policyVersion }
    func close() { generation += 1; operation?.cancel(); identity = nil; state = ProfileState() }
    func open(_ identity: Identity) {
        close()
        guard service != nil, identity.role == .patient || identity.role == .doctor else { return }
        self.identity = identity; check()
    }
    func accept(_ value: Bool) { if state.step == .missing && !state.busy { state.accepted = value } }
    func check() {
        guard let identity, let service, !state.busy else { return }
        run { [weak self] in
            self?.state = ProfileState(step: .checking, busy: true)
            let profile = try await Self.readMissing(service, identity: identity)
            self?.state = ProfileState(step: profile == nil ? .missing : .ready, profile: profile)
        }
    }
    func submit(name: String, email: String, specialization: String) {
        let details = ProfileDetails(name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                                     email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                                     specialization: specialization.trimmingCharacters(in: .whitespacesAndNewlines))
        guard let identity, let service, state.step == .missing, state.accepted, !state.busy,
              !policyVersion.isEmpty, !details.name.isEmpty, !details.email.isEmpty,
              identity.role != .doctor || !details.specialization.isEmpty else { return }
        let policyVersion = policyVersion
        run { [weak self] in
            if let existing = try await Self.readMissing(service, identity: identity) {
                self?.state = ProfileState(step: .ready, profile: existing); return
            }
            do { try await service.create(identity: identity, details: details, policyVersion: policyVersion) }
            catch let failure as HTTPFailure { if failure.status != 409 { throw failure } }
            try Task.checkCancellation()
            let profile = try await service.load(identity: identity)
            try Task.checkCancellation()
            guard profile.subject == identity.subject else { throw MobileFailure.response }
            self?.state = ProfileState(step: .ready, profile: profile)
        }
    }
    private static func readMissing(_ service: ProfileService, identity: Identity) async throws -> OwnProfile? {
        let profile: OwnProfile?
        do { profile = try await service.load(identity: identity) }
        catch let failure as HTTPFailure { if failure.status != 404 { throw failure }; profile = nil }
        try Task.checkCancellation()
        guard profile == nil || profile?.subject == identity.subject else { throw MobileFailure.response }
        return profile
    }
    private func run(_ block: @escaping @MainActor () async throws -> Void) {
        generation += 1; let current = generation; state.busy = true
        operation = Task { [weak self] in
            do { try await block() }
            catch is CancellationError { return }
            catch {
                guard let self, generation == current, !Task.isCancelled else { return }
                state = ProfileState(step: .failed)
            }
            if let self, generation == current { state.busy = false }
        }
    }
}
