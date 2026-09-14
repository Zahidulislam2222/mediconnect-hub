import Foundation

@MainActor protocol PatientExportService {
    func download(identity: Identity) async throws -> Data
}

@MainActor final class PatientExportAPI: PatientExportService {
    private let transport: NativeAPI
    private let contract: MobileContract
    private let maxResponseBytes: Int
    private let fetch: () async throws -> SessionAccess
    init(transport: NativeAPI, contract: MobileContract, maxResponseBytes: Int,
         fetch: @escaping () async throws -> SessionAccess) {
        self.transport = transport; self.contract = contract
        self.maxResponseBytes = maxResponseBytes; self.fetch = fetch
    }
    func download(identity: Identity) async throws -> Data {
        guard identity.role == .patient, identity.expiresAt > Date(),
              let route = contract.profiles[Role.patient.rawValue] else { throw MobileFailure.forbidden }
        let access = try await fetch()
        try Task.checkCancellation()
        guard access.identity.subject == identity.subject, access.identity.role == identity.role,
              access.identity.expiresAt > Date() else { throw MobileFailure.session }
        let response = try await transport.requestResponse(access: access, service: route.service, path: contract.patientExport.path)
        try Task.checkCancellation()
        let bytes = try PatientExportBundle.verifiedBytes(response, identity: identity, contract: contract.patientExport,
                                                         subjectField: route.subjectField, maxBytes: maxResponseBytes)
        try Task.checkCancellation()
        let current = try await fetch().identity
        try Task.checkCancellation()
        guard current.subject == identity.subject, current.role == identity.role,
              current.expiresAt > Date(), identity.expiresAt > Date() else { throw MobileFailure.session }
        return bytes
    }
}
