import XCTest
@testable import MediConnectApp

final class NativeBoundaryTests: XCTestCase {
    private func resource(_ name: String) throws -> Data {
        try Data(contentsOf: XCTUnwrap(Bundle(for: Self.self).url(forResource: name, withExtension: "json")))
    }
    private func contract() throws -> MobileContract { try MobileContract(data: resource("mobile-contract"), policy: resource("session-policy")) }
    private func config(_ residency: String = "US") throws -> MobileConfiguration {
        let source: [String: Any] = ["requestTimeoutSeconds": 30, "maxResponseBytes": 1048576, "regions": [
            "US": ["awsRegion": "us-east-1", "userPoolId": "us-east-1_testpool", "clientId": "testclient", "issuer": "https://us.example.test/testpool", "services": ["booking": "https://us.example.test"]],
            "EU": ["awsRegion": "eu-central-1", "userPoolId": "eu-central-1_testpool", "clientId": "testclient", "issuer": "https://eu.example.test/testpool", "services": ["booking": "https://eu.example.test"]]
        ]]
        return try MobileConfiguration(data: JSONSerialization.data(withJSONObject: source), residency: residency)
    }
    private let now = Date(timeIntervalSince1970: 1788998400)
    private func claims() -> [String: Any] {
        ["sub": "test-patient", "exp": now.timeIntervalSince1970 + 60, "iss": "https://us.example.test/testpool", "aud": "testclient", "token_use": "id"]
    }
    private func session(_ claims: [String: Any], residency: String = "US") throws -> SessionAccess {
        let data = try JSONSerialization.data(withJSONObject: claims)
        let payload = data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
        return try SessionClaims.fromSDKToken("test-header." + payload + ".test-signature", config: config(residency), contract: contract(), now: now)
    }
    func testBlankConfigurationBlocksConnections() throws {
        XCTAssertThrowsError(try MobileConfiguration(data: resource("mobile-config.example"), residency: "US"))
    }
    func testUnsafeBaseURLsAreRejected() {
        for url in ["http://example.test", "https://test-user:test-value@example.test", "https://example.test/?value=test", "https://example.test/#fragment"] {
            XCTAssertThrowsError(try MobileConfiguration.secureURL(url))
        }
    }
    func testValidPatientAndDoctorRoles() throws {
        XCTAssertEqual(try session(claims()).identity.role, .patient)
        var doctor = claims(); doctor["cognito:groups"] = ["practitioner"]
        XCTAssertEqual(try session(doctor).identity.role, .doctor)
    }
    func testInvalidRolesAreRejected() {
        for groups in [["unknown"], ["patient", "admin"], "doctor", [9], NSNull()] as [Any] {
            var invalid = claims(); invalid["cognito:groups"] = groups
            XCTAssertThrowsError(try session(invalid))
        }
    }
    func testExpiredAndForeignRegionalTokensAreRejected() {
        var expired = claims(); expired["exp"] = now.timeIntervalSince1970
        XCTAssertThrowsError(try session(expired))
        XCTAssertThrowsError(try session(claims(), residency: "EU"))
    }
    func testWrongAudienceAndAccessTokensAreRejected() {
        var wrong = claims(); wrong["aud"] = "otherclient"
        XCTAssertThrowsError(try session(wrong))
        wrong = claims(); wrong["token_use"] = "access"
        XCTAssertThrowsError(try session(wrong))
    }
    func testMissingClinicalFieldsStayMissing() throws {
        let data = Data(#"{"existingBookings":[{"appointmentId":"test-appointment","patientId":"test-patient","timeSlot":"invalid"}]}"#.utf8)
        let item = try XCTUnwrap(AppointmentDecoder.decode(data, identity: session(claims()).identity, contract: contract()).items.first)
        XCTAssertNil(item.time); XCTAssertNil(item.person); XCTAssertNil(item.status)
    }
    func testWrongPatientAndMalformedResponseAreRejected() throws {
        for body in [#"{"existingBookings":[{"appointmentId":"test-appointment","patientId":"other-patient"}]}"#, "{}", "null"] {
            XCTAssertThrowsError(try AppointmentDecoder.decode(Data(body.utf8), identity: session(claims()).identity, contract: contract()))
        }
    }
    func testEmptyResponseIsAccepted() throws {
        let page = try AppointmentDecoder.decode(Data(#"{"existingBookings":[]}"#.utf8), identity: session(claims()).identity, contract: contract())
        XCTAssertTrue(page.items.isEmpty)
        XCTAssertNil(page.next)
    }
    func testStaffAndAdminDoNotGetPatientQueries() throws {
        XCTAssertNil(try contract().appointments.query[Role.staff.rawValue])
        XCTAssertNil(try contract().appointments.query[Role.admin.rawValue])
    }
}
