import Foundation

struct Identity: Equatable {
    let subject: String
    let role: Role
    let expiresAt: Date
}

struct SessionAccess {
    let identity: Identity
    let token: String
}

enum SessionClaims {
    private struct Claims: Decodable {
        let subject: String
        let expires: Double
        let issuer: String
        let audience: String
        let use: String
        let groups: [String]?
        enum CodingKeys: String, CodingKey {
            case subject = "sub", expires = "exp", issuer = "iss", audience = "aud", use = "token_use", groups = "cognito:groups"
        }
        init(from decoder: Decoder) throws {
            let values = try decoder.container(keyedBy: CodingKeys.self)
            subject = try values.decode(String.self, forKey: .subject)
            expires = try values.decode(Double.self, forKey: .expires)
            issuer = try values.decode(String.self, forKey: .issuer)
            audience = try values.decode(String.self, forKey: .audience)
            use = try values.decode(String.self, forKey: .use)
            groups = values.contains(.groups) ? try values.decode([String].self, forKey: .groups) : nil
        }
    }
    /// UI identity derives only from the SDK session. The API independently verifies signatures and authorization.
    static func fromSDKToken(_ token: String, config: MobileConfiguration, contract: MobileContract, now: Date) throws -> SessionAccess {
        let parts = token.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 3 else { throw MobileFailure.session }
        var payload = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        payload += String(repeating: "=", count: (4 - payload.count % 4) % 4)
        guard let data = Data(base64Encoded: payload) else { throw MobileFailure.session }
        let claims = try JSONDecoder().decode(Claims.self, from: data)
        guard claims.issuer == config.region.issuer, claims.audience == config.region.clientId,
              claims.use == "id", claims.expires.isFinite, claims.expires > now.timeIntervalSince1970,
              claims.subject.range(of: "^[A-Za-z0-9.-]{1,64}$", options: .regularExpression) != nil else { throw MobileFailure.session }
        return SessionAccess(identity: Identity(subject: claims.subject, role: try contract.role(claims.groups),
                                               expiresAt: Date(timeIntervalSince1970: claims.expires)), token: token)
    }
}
