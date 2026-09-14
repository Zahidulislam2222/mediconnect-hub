import Foundation

@MainActor protocol PatientSettingsService {
    func load(identity: Identity) async throws -> PatientSettingsSnapshot
    func save(identity: Identity, snapshot: PatientSettingsSnapshot, draft: PatientSettingsDraft) async throws
}

@MainActor final class PatientSettingsAPI: PatientSettingsService {
    private let transport: NativeAPI
    private let contract: MobileContract
    private let fetch: () async throws -> SessionAccess
    init(transport: NativeAPI, contract: MobileContract, fetch: @escaping () async throws -> SessionAccess) {
        self.transport = transport; self.contract = contract; self.fetch = fetch
    }
    private func route(_ identity: Identity) throws -> ProfileContract {
        guard identity.role == .patient, let route = contract.profiles[Role.patient.rawValue] else { throw MobileFailure.forbidden }
        return route
    }
    private func access(_ identity: Identity) async throws -> SessionAccess {
        let result = try await fetch()
        try Task.checkCancellation()
        guard result.identity.subject == identity.subject, result.identity.role == identity.role else { throw MobileFailure.session }
        return result
    }
    func load(identity: Identity) async throws -> PatientSettingsSnapshot {
        let route = try route(identity)
        let session = try await access(identity)
        let path = route.readPath + (route.appendSubject ? "/" + identity.subject : "")
        let data = try await transport.request(access: session, service: route.service, path: path)
        try Task.checkCancellation()
        return try PatientSettingsData.decode(data, identity: identity, subjectField: route.subjectField)
    }
    func save(identity: Identity, snapshot: PatientSettingsSnapshot, draft: PatientSettingsDraft) async throws {
        let route = try route(identity)
        guard snapshot.subject == identity.subject else { throw MobileFailure.forbidden }
        let changes = try PatientSettingsData.changes(snapshot: snapshot, draft: draft, maxNameLength: contract.patientSettings.maxNameLength)
        guard !changes.isEmpty else { return }
        let session = try await access(identity)
        _ = try await transport.request(access: session, service: route.service,
            path: contract.patientSettings.updatePath + "/" + identity.subject, body: changes, method: .put)
        try Task.checkCancellation()
    }
}
