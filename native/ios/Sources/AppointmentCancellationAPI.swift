import Foundation

@MainActor final class AppointmentCancellationAPI: CancellationService {
    private let appointments: AppointmentsAPI
    private let transport: NativeAPI
    private let contract: MobileContract
    private let fetch: () async throws -> SessionAccess
    init(appointments: AppointmentsAPI, transport: NativeAPI, contract: MobileContract, fetch: @escaping () async throws -> SessionAccess) {
        self.appointments = appointments; self.transport = transport; self.contract = contract; self.fetch = fetch
    }
    private func access(_ identity: Identity) async throws -> SessionAccess {
        guard identity.role == .patient else { throw MobileFailure.forbidden }
        let access = try await fetch()
        try Task.checkCancellation()
        guard access.identity.subject == identity.subject, access.identity.role == identity.role else { throw MobileFailure.session }
        return access
    }
    func find(identity: Identity, appointmentId: String) async throws -> Appointment {
        var cursor: String?; var seen = Set<String>()
        for _ in 0..<contract.cancellation.maxLookupPages {
            let access = try await access(identity)
            let page = try await appointments.load(access: access, cursor: cursor)
            try Task.checkCancellation()
            if let found = page.items.first(where: { $0.id == appointmentId }) { return found }
            guard let next = page.next else { throw HTTPFailure(status: 404) }
            guard seen.insert(next).inserted else { throw MobileFailure.response }
            cursor = next
        }
        throw MobileFailure.response
    }
    func cancel(identity: Identity, appointmentId: String) async throws {
        guard !appointmentId.isEmpty else { throw MobileFailure.response }
        let access = try await access(identity)
        _ = try await transport.request(access: access, service: contract.appointments.service,
                                        path: contract.cancellation.path, body: ["appointmentId": appointmentId])
    }
}
