import Foundation

struct PatientSettingsSnapshot: Equatable {
    let subject: String
    let name: String
    let email: String
    let phone: String?
    let address: String?
    let preferences: [String: Bool]?
}
struct PatientSettingsDraft: Equatable {
    var name: String
    var phone: String?
    var address: String?
    var preferences: [String: Bool]?
    init(snapshot: PatientSettingsSnapshot) {
        name = snapshot.name; phone = snapshot.phone; address = snapshot.address; preferences = snapshot.preferences
    }
}
enum PatientSettingsData {
    private static let preferenceKeys: Set<String> = ["email", "sms", "promotional"]
    static var preferenceNames: [String] { preferenceKeys.sorted() }
    static func decode(_ data: Data, identity: Identity, subjectField: String) throws -> PatientSettingsSnapshot {
        guard identity.role == .patient,
              let row = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw MobileFailure.response }
        func requiredString(_ key: String) throws -> String {
            guard let value = row[key] as? String,
                  !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw MobileFailure.response }
            return value
        }
        func optionalString(_ key: String) throws -> String? {
            guard let value = row[key], !(value is NSNull) else { return nil }
            guard let text = value as? String else { throw MobileFailure.response }
            return text
        }
        let subject = try requiredString(subjectField)
        guard subject == identity.subject else { throw MobileFailure.response }
        var preferences: [String: Bool]?
        if let value = row["preferences"], !(value is NSNull) {
            guard value is [String: Any] else { throw MobileFailure.response }
            preferences = try JSONDecoder().decode([String: Bool].self, from: JSONSerialization.data(withJSONObject: value))
            guard Set(preferences?.keys.map { $0 } ?? []).isSubset(of: preferenceKeys) else { throw MobileFailure.response }
        }
        return try PatientSettingsSnapshot(subject: subject, name: requiredString("name"), email: requiredString("email"),
                                           phone: optionalString("phone"), address: optionalString("address"), preferences: preferences)
    }
    static func changes(snapshot: PatientSettingsSnapshot, draft: PatientSettingsDraft, maxNameLength: Int) throws -> [String: Any] {
        guard maxNameLength > 0, !draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              draft.name.utf16.count <= maxNameLength,
              Set(draft.preferences?.keys.map { $0 } ?? []).isSubset(of: preferenceKeys) else { throw MobileFailure.configuration }
        var body: [String: Any] = [:]
        if draft.name != snapshot.name { body["name"] = draft.name }
        if draft.phone != snapshot.phone {
            guard let phone = draft.phone else { throw MobileFailure.configuration }; body["phone"] = phone
        }
        if draft.address != snapshot.address {
            guard let address = draft.address else { throw MobileFailure.configuration }; body["address"] = address
        }
        if draft.preferences != snapshot.preferences {
            guard let preferences = draft.preferences,
                  Set(snapshot.preferences?.keys.map { $0 } ?? []).isSubset(of: Set(preferences.keys)) else { throw MobileFailure.configuration }
            body["preferences"] = preferences
        }
        return body
    }
}
