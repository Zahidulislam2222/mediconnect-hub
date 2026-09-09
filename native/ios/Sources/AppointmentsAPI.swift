import Foundation

struct Appointment: Identifiable {
    let id: String
    let time: Date?
    let person: String?
    let status: String?
}
struct AppointmentPage { let items: [Appointment]; let next: String? }
struct HTTPFailure: Error { let status: Int? }

enum AppointmentDecoder {
    static func decode(_ data: Data, identity: Identity, contract: MobileContract) throws -> AppointmentPage {
        let source = try JSONSerialization.jsonObject(with: data)
        let envelope = source as? [String: Any]
        let rows = source as? [[String: Any]] ?? contract.appointments.listKeys.compactMap { envelope?[$0] as? [[String: Any]] }.first
        guard let rows, let subjectKey = contract.appointments.query[identity.role.rawValue] else { throw MobileFailure.response }
        let formatter = ISO8601DateFormatter()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions.insert(.withFractionalSeconds)
        let items = try rows.map { row -> Appointment in
            func text(_ key: String) -> String? {
                guard let value = row[key] as? String else { return nil }
                let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                return trimmed.isEmpty ? nil : trimmed
            }
            guard row[subjectKey] as? String == identity.subject, let id = text("appointmentId") else { throw MobileFailure.response }
            let rawTime = text("timeSlot") ?? (row["resource"] as? [String: Any])?["start"] as? String
            let time = rawTime.flatMap { formatter.date(from: $0) ?? fractional.date(from: $0) }
            return Appointment(id: id, time: time, person: text(identity.role == .patient ? "doctorName" : "patientName"), status: text("status"))
        }
        guard Set(items.map(\.id)).count == items.count else { throw MobileFailure.response }
        var cursor: String?
        if let key = envelope?["lastEvaluatedKey"] as? [String: Any], !key.isEmpty {
            cursor = String(data: try JSONSerialization.data(withJSONObject: key, options: .sortedKeys), encoding: .utf8)
        }
        return AppointmentPage(items: items, next: cursor)
    }
}

final class AppointmentsAPI {
    private let transport: NativeAPI
    private let contract: MobileContract
    init(config: MobileConfiguration, contract: MobileContract) {
        transport = NativeAPI(config: config); self.contract = contract
    }
    func load(access: SessionAccess, cursor: String?) async throws -> AppointmentPage {
        guard let subjectKey = contract.appointments.query[access.identity.role.rawValue] else { throw MobileFailure.forbidden }
        var query = [subjectKey: access.identity.subject]
        if let cursor { query["startKey"] = cursor }
        let data = try await transport.request(access: access, service: contract.appointments.service, path: contract.appointments.path, query: query)
        return try AppointmentDecoder.decode(data, identity: access.identity, contract: contract)
    }
}
