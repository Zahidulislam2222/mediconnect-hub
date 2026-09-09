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

final class RejectRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

final class AppointmentsAPI {
    private let config: MobileConfiguration
    private let contract: MobileContract
    private let session: URLSession
    init(config: MobileConfiguration, contract: MobileContract) {
        self.config = config
        self.contract = contract
        let settings = URLSessionConfiguration.ephemeral
        settings.urlCache = nil
        settings.httpCookieStorage = nil
        settings.httpShouldSetCookies = false
        settings.requestCachePolicy = .reloadIgnoringLocalCacheData
        settings.timeoutIntervalForRequest = config.requestTimeoutSeconds
        settings.timeoutIntervalForResource = config.requestTimeoutSeconds
        session = URLSession(configuration: settings, delegate: RejectRedirects(), delegateQueue: nil)
    }
    deinit { session.invalidateAndCancel() }

    func load(access: SessionAccess, cursor: String?) async throws -> AppointmentPage {
        guard access.identity.expiresAt > Date(), let subjectKey = contract.appointments.query[access.identity.role.rawValue],
              let base = config.services[contract.appointments.service],
              var url = URLComponents(url: base, resolvingAgainstBaseURL: false),
              contract.appointments.path.range(of: "^/[A-Za-z0-9/_-]+$", options: .regularExpression) != nil,
              !contract.appointments.path.contains("//") else { throw MobileFailure.forbidden }
        url.path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + contract.appointments.path
        if !url.path.hasPrefix("/") { url.path = "/" + url.path }
        url.queryItems = [URLQueryItem(name: subjectKey, value: access.identity.subject)]
        if let cursor { url.queryItems?.append(URLQueryItem(name: "startKey", value: cursor)) }
        guard let endpoint = url.url else { throw MobileFailure.configuration }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "GET"
        request.setValue("Bearer " + access.token, forHTTPHeaderField: "Authorization")
        request.setValue(config.residency, forHTTPHeaderField: "x-user-region")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        let (bytes, response) = try await session.bytes(for: request)
        defer { bytes.task.cancel() }
        guard let response = response as? HTTPURLResponse else { throw HTTPFailure(status: nil) }
        guard (200..<300).contains(response.statusCode) else { throw HTTPFailure(status: response.statusCode) }
        guard response.expectedContentLength <= config.maxResponseBytes else { throw MobileFailure.response }
        var data = Data()
        for try await byte in bytes {
            try Task.checkCancellation()
            guard data.count < config.maxResponseBytes else { throw MobileFailure.response }
            data.append(byte)
        }
        return try AppointmentDecoder.decode(data, identity: access.identity, contract: contract)
    }
}
