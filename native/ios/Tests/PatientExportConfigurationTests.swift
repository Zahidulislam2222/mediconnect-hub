import Foundation
import XCTest
@testable import MediConnectApp

final class PatientExportConfigurationTests: XCTestCase {
    private func contract(_ changes: [String: Any] = [:]) throws -> PatientExportContract {
        var value: [String: Any] = ["path": "/me/export", "collections": ["patient", "appointments"],
                                  "ownerCollection": "patient", "maxJsonDepth": 64]
        value.merge(changes) { _, replacement in replacement }
        return try JSONDecoder().decode(PatientExportContract.self,
                                       from: JSONSerialization.data(withJSONObject: value))
    }

    func testValidContractAndChangedConfigurationAreAccepted() throws {
        try contract().validate()
        try contract(["path": "/archive/export", "collections": ["owner", "records"],
                      "ownerCollection": "owner", "maxJsonDepth": 8]).validate()
    }

    func testInvalidContractCannotReachTheExportFlow() throws {
        let changes: [[String: Any]] = [
            ["path": "https://example.test/export"], ["path": "/me//export"],
            ["path": "/me/export/"], ["path": "/me/export?all=true"],
            ["collections": []], ["collections": ["patient", "patient"]],
            ["collections": ["patient", "bad-name"]], ["ownerCollection": "missing"],
            ["maxJsonDepth": 0], ["maxJsonDepth": -1], ["maxJsonDepth": "64"]
        ]
        for change in changes {
            XCTAssertThrowsError(try contract(change).validate())
        }
    }
}
