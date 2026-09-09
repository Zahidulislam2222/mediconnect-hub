import Foundation

struct PolicySection: Decodable { let title: String; let body: String }
struct PolicySource: Decodable { let label: String; let url: String }
struct PolicyPage: Decodable { let title: String; let sections: [PolicySection]; let sources: [PolicySource] }
struct MobilePolicies {
    let notice: String
    let policyVersion: String
    let acceptance: String
    let pages: [String: PolicyPage]
    init(legal: Data, consent: Data) throws {
        struct Legal: Decodable { let notice: String; let pages: [String: PolicyPage] }
        struct Consent: Decodable { let policyVersion: String; let signupDescription: String }
        let legal = try JSONDecoder().decode(Legal.self, from: legal)
        let consent = try JSONDecoder().decode(Consent.self, from: consent)
        guard !legal.notice.isEmpty, !consent.policyVersion.isEmpty, !consent.signupDescription.isEmpty,
              ["privacy", "terms", "security"].allSatisfy({ legal.pages[$0] != nil }) else { throw MobileFailure.configuration }
        notice = legal.notice; pages = legal.pages
        policyVersion = consent.policyVersion; acceptance = consent.signupDescription
    }
}
