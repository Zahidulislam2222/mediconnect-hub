import Foundation

@MainActor final class ProfileAPI: ProfileService {
    private let transport: NativeAPI
    private let contract: MobileContract
    private let fetch: () async throws -> SessionAccess
    init(transport: NativeAPI, contract: MobileContract, fetch: @escaping () async throws -> SessionAccess) {
        self.transport = transport; self.contract = contract; self.fetch = fetch
    }
    private func access(_ identity: Identity) async throws -> SessionAccess {
        let access = try await fetch()
        try Task.checkCancellation()
        guard access.identity.subject == identity.subject, access.identity.role == identity.role else { throw MobileFailure.session }
        return access
    }
    func load(identity: Identity) async throws -> OwnProfile {
        guard let route = contract.profiles[identity.role.rawValue] else { throw MobileFailure.forbidden }
        let session = try await access(identity)
        let path = route.readPath + (route.appendSubject ? "/" + identity.subject : "")
        let data = try await transport.request(access: session, service: route.service, path: path)
        guard let row = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              row[route.subjectField] as? String == identity.subject,
              let name = row["name"] as? String, !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let email = row["email"] as? String, !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw MobileFailure.response }
        return OwnProfile(subject: identity.subject, name: name, email: email)
    }
    func create(identity: Identity, details: ProfileDetails, policyVersion: String) async throws {
        guard let route = contract.profiles[identity.role.rawValue], !details.name.isEmpty, !details.email.isEmpty,
              !policyVersion.isEmpty else { throw MobileFailure.forbidden }
        var body: [String: Any] = ["name": details.name, "email": details.email,
                                  "consentDetails": ["agreedToTerms": true, "policyVersion": policyVersion]]
        if identity.role == .doctor {
            guard !details.specialization.isEmpty else { throw MobileFailure.response }
            body["specialization"] = details.specialization
        }
        let session = try await access(identity)
        _ = try await transport.request(access: session, service: route.service, path: route.createPath, body: body)
    }
}
