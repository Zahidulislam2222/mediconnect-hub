import Foundation

struct PolicySection: Decodable { let title: String; let body: String }
struct PolicySource: Decodable { let label: String; let url: String }
struct PolicyPage: Decodable { let title: String; let sections: [PolicySection]; let sources: [PolicySource] }
struct MobilePolicies {
    let updated: String
    let notice: String
    let policyVersion: String
    let acceptance: String
    let pages: [String: PolicyPage]
    init(legal: Data, consent: Data) throws {
        struct Legal: Decodable { let updated: String; let notice: String; let pages: [String: PolicyPage] }
        struct Consent: Decodable { let policyVersion: String; let signupDescription: String }
        let legal = try JSONDecoder().decode(Legal.self, from: legal)
        let consent = try JSONDecoder().decode(Consent.self, from: consent)
        let keys = ["privacy", "terms", "security"]
        let strings = [legal.notice, consent.policyVersion, consent.signupDescription] + legal.pages.values.flatMap {
            [$0.title] + $0.sections.flatMap { [$0.title, $0.body] } + $0.sources.flatMap { [$0.label, $0.url] }
        }
        guard strings.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }),
              legal.updated.range(of: "\\A[0-9]{4}-[0-9]{2}-[0-9]{2}\\z", options: .regularExpression) != nil,
              keys.allSatisfy({ legal.pages[$0] != nil }),
              legal.pages.values.allSatisfy({ !$0.sections.isEmpty && $0.sources.allSatisfy { Self.validCitation($0.url) } }) else {
            throw MobileFailure.configuration
        }
        updated = legal.updated; notice = legal.notice
        pages = legal.pages.filter { keys.contains($0.key) }
        policyVersion = consent.policyVersion; acceptance = consent.signupDescription
    }

    private static func validCitation(_ value: String) -> Bool {
        guard value.rangeOfCharacter(from: .whitespacesAndNewlines.union(.controlCharacters)) == nil,
              let parts = URLComponents(string: value), parts.scheme?.lowercased() == "https",
              let host = parts.host, !host.isEmpty, parts.user == nil, parts.password == nil,
              parts.url != nil else { return false }
        return true
    }
}
