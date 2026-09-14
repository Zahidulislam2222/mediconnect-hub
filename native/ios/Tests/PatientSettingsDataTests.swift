import Foundation
import XCTest
@testable import MediConnectApp

final class PatientSettingsDataTests: XCTestCase {
    private var identity: Identity { Identity(subject: "test-patient", role: .patient, expiresAt: Date().addingTimeInterval(300)) }
    private func row() -> [String: Any] { ["patientId": "test-patient", "name": "Test person", "email": "test@example.test"] }
    private func decode(_ value: [String: Any]) throws -> PatientSettingsSnapshot {
        try PatientSettingsData.decode(JSONSerialization.data(withJSONObject: value), identity: identity, subjectField: "patientId")
    }
    func testAbsentValuesAndUnchangedDraftStayAbsent() throws {
        let snapshot = try decode(row())
        XCTAssertNil(snapshot.phone); XCTAssertNil(snapshot.address); XCTAssertNil(snapshot.preferences)
        XCTAssertTrue(try PatientSettingsData.changes(snapshot: snapshot, draft: PatientSettingsDraft(snapshot: snapshot), maxNameLength: 200).isEmpty)
        var value = row(); value["phone"] = NSNull(); value["preferences"] = NSNull()
        XCTAssertEqual(snapshot, try decode(value))
    }
    func testMalformedFieldsAndForeignIdentityAreRejected() throws {
        for key in ["patientId", "name", "email", "phone", "address"] {
            var value = row(); value[key] = 1; XCTAssertThrowsError(try decode(value))
        }
        var value = row(); value["patientId"] = "other"; XCTAssertThrowsError(try decode(value))
        let doctor = Identity(subject: identity.subject, role: .doctor, expiresAt: identity.expiresAt)
        XCTAssertThrowsError(try PatientSettingsData.decode(JSONSerialization.data(withJSONObject: row()), identity: doctor, subjectField: "patientId"))
    }
    func testPreferencesRejectCoercionAndPreserveMissingChoices() throws {
        var value = row(); value["preferences"] = ["email": false]
        XCTAssertEqual(try decode(value).preferences, ["email": false])
        for invalid in ["true", 1, NSNull()] as [Any] {
            value["preferences"] = ["email": invalid]; XCTAssertThrowsError(try decode(value))
        }
        value["preferences"] = ["unknown": true]; XCTAssertThrowsError(try decode(value))
    }
    func testChangesContainOnlyEditedFields() throws {
        var value = row(); value["preferences"] = ["email": false]
        let snapshot = try decode(value)
        var draft = PatientSettingsDraft(snapshot: snapshot); draft.phone = ""; draft.preferences = ["email": false, "sms": true]
        let changes = try PatientSettingsData.changes(snapshot: snapshot, draft: draft, maxNameLength: 200)
        XCTAssertEqual(Set(changes.keys), ["phone", "preferences"])
        XCTAssertEqual(changes["preferences"] as? [String: Bool], ["email": false, "sms": true])
    }
    func testConfiguredNameBoundAndKnownChoicesCannotBeDiscarded() throws {
        var value = row(); value["preferences"] = ["email": false]
        let snapshot = try decode(value)
        var draft = PatientSettingsDraft(snapshot: snapshot); draft.preferences = [:]
        XCTAssertThrowsError(try PatientSettingsData.changes(snapshot: snapshot, draft: draft, maxNameLength: 200))
        draft = PatientSettingsDraft(snapshot: snapshot); draft.name = "😀"
        XCTAssertThrowsError(try PatientSettingsData.changes(snapshot: snapshot, draft: draft, maxNameLength: 1))
        draft.name = " "
        XCTAssertThrowsError(try PatientSettingsData.changes(snapshot: snapshot, draft: draft, maxNameLength: 200))
    }
}
