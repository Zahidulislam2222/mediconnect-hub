import Foundation

enum MobileFailure: Error { case configuration, session, response, forbidden }
enum Role: String, Codable { case patient, doctor, staff, admin }

struct RegionConfiguration: Decodable {
    let awsRegion: String
    let userPoolId: String
    let clientId: String
    let issuer: String
    let services: [String: String]
}

struct ConfigurationDocument: Decodable {
    let requestTimeoutSeconds: Double
    let maxResponseBytes: Int
    let regions: [String: RegionConfiguration]
}

struct MobileConfiguration {
    let residency: String
    let region: RegionConfiguration
    let requestTimeoutSeconds: Double
    let maxResponseBytes: Int
    let services: [String: URL]

    init(data: Data, residency: String) throws {
        let document = try JSONDecoder().decode(ConfigurationDocument.self, from: data)
        guard ["US", "EU"].contains(residency), let region = document.regions[residency],
              document.requestTimeoutSeconds > 0, document.requestTimeoutSeconds.isFinite,
              document.maxResponseBytes > 0, document.maxResponseBytes < Int(Int32.max),
              region.awsRegion.range(of: "^[a-z]{2}-[a-z]+-[0-9]$", options: .regularExpression) != nil,
              region.userPoolId.hasPrefix(region.awsRegion + "_"),
              region.userPoolId.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil,
              region.clientId.range(of: "^[a-z0-9]+$", options: .regularExpression) != nil else { throw MobileFailure.configuration }
        _ = try Self.secureURL(region.issuer)
        self.residency = residency
        self.region = region
        self.requestTimeoutSeconds = document.requestTimeoutSeconds
        self.maxResponseBytes = document.maxResponseBytes
        self.services = try region.services.mapValues(Self.secureURL)
    }

    static func secureURL(_ value: String) throws -> URL {
        guard let parts = URLComponents(string: value), parts.scheme == "https",
              let host = parts.host, !host.isEmpty, parts.user == nil, parts.password == nil,
              parts.query == nil, parts.fragment == nil, let url = parts.url else { throw MobileFailure.configuration }
        return url
    }
}

struct ProfileContract: Decodable {
    let service: String
    let readPath: String
    let appendSubject: Bool
    let createPath: String
    let subjectField: String
}

struct CancellationContract: Decodable {
    let path: String
    let cancellableStatuses: Set<String>
    let cancelledStatuses: Set<String>
    let maxLookupPages: Int
}

struct MobileContract {
    struct AppointmentContract: Decodable {
        let service: String
        let path: String
        let query: [String: String]
        let listKeys: [String]
    }
    let groups: [String: Role]
    let defaultRole: Role
    let appointments: AppointmentContract
    let profiles: [String: ProfileContract]
    let cancellation: CancellationContract

    init(data: Data, policy: Data) throws {
        struct Document: Decodable { let appointments: AppointmentContract; let profiles: [String: ProfileContract]; let cancellation: CancellationContract }
        struct Policy: Decodable { let groups: [String: Role]; let defaultRole: Role }
        let document = try JSONDecoder().decode(Document.self, from: data)
        appointments = document.appointments
        profiles = document.profiles
        cancellation = document.cancellation
        guard cancellation.maxLookupPages > 0, !cancellation.cancellableStatuses.isEmpty, !cancellation.cancelledStatuses.isEmpty,
              cancellation.path.range(of: "^/[A-Za-z0-9/_-]+$", options: .regularExpression) != nil, !cancellation.path.contains("//") else { throw MobileFailure.configuration }
        let roles = try JSONDecoder().decode(Policy.self, from: policy)
        groups = roles.groups
        defaultRole = roles.defaultRole
    }

    func role(_ claimed: [String]?) throws -> Role {
        guard let claimed, !claimed.isEmpty else { return defaultRole }
        let roles = Set(claimed.compactMap { groups[$0] })
        guard roles.count == 1, let role = roles.first else { throw MobileFailure.session }
        return role
    }
}

struct MobileContent {
    private let values: [String: Any]
    init(data: Data) throws {
        guard let values = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw MobileFailure.configuration }
        self.values = values
    }
    func text(_ key: String) -> String { values[key] as? String ?? key }
    func label(_ group: String, _ key: String) -> String { (values[group] as? [String: String])?[key] ?? key }
}

enum BundledAssets {
    static func data(_ name: String) throws -> Data {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json") else { throw MobileFailure.configuration }
        return try Data(contentsOf: url)
    }
}
