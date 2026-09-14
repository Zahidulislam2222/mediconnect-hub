import CryptoKit
import Foundation
import XCTest
@testable import MediConnectApp

final class PatientExportBundleTests: XCTestCase {
    private struct Fixture: Decodable { let subject: String; let integrity: String; let bodyBase64: String }
    private func resource(_ name: String) throws -> Data {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: name, withExtension: "json"))
        return try Data(contentsOf: url)
    }
    private func fixture() throws -> Fixture { try JSONDecoder().decode(Fixture.self, from: resource("export-bundle")) }
    private func body() throws -> Data { try XCTUnwrap(Data(base64Encoded: fixture().bodyBase64)) }
    private func contract() throws -> MobileContract {
        try MobileContract(data: resource("mobile-contract"), policy: resource("session-policy"))
    }
    private func response(_ bytes: Data) -> NativeResponse {
        NativeResponse(body: bytes, status: 200,
                       exportIntegrity: SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined())
    }
    private func verify(_ bytes: Data, identity: Identity? = nil) throws -> Data {
        let owner = try identity ?? Identity(subject: fixture().subject, role: .patient, expiresAt: .distantFuture)
        let rules = try contract()
        let settings = try JSONDecoder().decode(ConfigurationDocument.self, from: resource("mobile-config.example"))
        return try PatientExportBundle.verifiedBytes(response(bytes), identity: owner, contract: rules.patientExport,
            subjectField: XCTUnwrap(rules.profiles["patient"]).subjectField, maxBytes: settings.maxResponseBytes)
    }
    private func changed(_ edit: (inout [String: Any]) throws -> Void) throws -> Data {
        var bundle = try XCTUnwrap(JSONSerialization.jsonObject(with: body()) as? [String: Any])
        try edit(&bundle)
        return try JSONSerialization.data(withJSONObject: bundle)
    }
    private func payload(_ text: String) throws -> Data {
        try changed { bundle in
            var entries = try XCTUnwrap(bundle["entry"] as? [[String: Any]])
            var binary = try XCTUnwrap(entries[0]["resource"] as? [String: Any])
            binary["data"] = Data(text.utf8).base64EncodedString()
            entries[0]["resource"] = binary; bundle["entry"] = entries
        }
    }

    func testBackendFixturePreservesEveryByte() throws {
        let bytes = try body()
        XCTAssertEqual(try verify(bytes), bytes)
        let spaced = Data(" \n".utf8) + bytes + Data("\n".utf8)
        XCTAssertEqual(try verify(spaced), spaced)
        XCTAssertEqual(response(bytes).exportIntegrity, try fixture().integrity)
    }

    func testForeignExpiredAndNonpatientIdentityRejected() throws {
        let bytes = try body(), subject = try fixture().subject
        for owner in [Identity(subject: "other-patient", role: .patient, expiresAt: .distantFuture),
                      Identity(subject: subject, role: .doctor, expiresAt: .distantFuture),
                      Identity(subject: subject, role: .patient, expiresAt: .distantPast),
                      Identity(subject: "", role: .patient, expiresAt: .distantFuture)] {
            XCTAssertThrowsError(try verify(bytes, identity: owner))
        }
    }

    func testWrongBundleAndMissingOrRepeatedEntriesRejected() throws {
        for (key, value) in [("resourceType", "Patient"), ("type", "transaction"), ("timestamp", "not-a-date"), ("unexpected", "value")] {
            XCTAssertThrowsError(try verify(changed { $0[key] = value }))
        }
        for duplicate in [false, true] {
            XCTAssertThrowsError(try verify(changed { bundle in
                var entries = try XCTUnwrap(bundle["entry"] as? [[String: Any]])
                if duplicate { entries[1] = entries[0] } else { entries.removeLast() }
                bundle["entry"] = entries
            }))
        }
    }

    func testIntegritySizeDepthAndBinaryMetadataAreRequired() throws {
        let bytes = try body(), rules = try contract()
        let owner = Identity(subject: try fixture().subject, role: .patient, expiresAt: .distantFuture)
        let subjectField = try XCTUnwrap(rules.profiles["patient"]).subjectField
        for response in [NativeResponse(body: bytes, status: 200, exportIntegrity: nil),
                         NativeResponse(body: bytes, status: 206, exportIntegrity: try fixture().integrity)] {
            XCTAssertThrowsError(try PatientExportBundle.verifiedBytes(response, identity: owner,
                contract: rules.patientExport, subjectField: subjectField, maxBytes: bytes.count))
        }
        XCTAssertThrowsError(try PatientExportBundle.verifiedBytes(response(bytes), identity: owner,
            contract: rules.patientExport, subjectField: subjectField, maxBytes: bytes.count - 1))
        let shallow = PatientExportContract(path: rules.patientExport.path, collections: rules.patientExport.collections,
            ownerCollection: rules.patientExport.ownerCollection, maxJsonDepth: 1)
        XCTAssertThrowsError(try PatientExportBundle.verifiedBytes(response(bytes), identity: owner,
            contract: shallow, subjectField: subjectField, maxBytes: bytes.count))
        for (key, value) in [("resourceType", "Patient"), ("contentType", "text/plain"), ("id", "invalid"),
                             ("data", "!not-base64!"), ("data", "e30"), ("data", "e30=\n")] {
            XCTAssertThrowsError(try verify(changed { bundle in
                var entries = try XCTUnwrap(bundle["entry"] as? [[String: Any]])
                var binary = try XCTUnwrap(entries[0]["resource"] as? [String: Any])
                binary[key] = value; entries[0]["resource"] = binary; bundle["entry"] = entries
            }))
        }
        XCTAssertThrowsError(try verify(changed { bundle in
            var entries = try XCTUnwrap(bundle["entry"] as? [[String: Any]])
            entries[0]["fullUrl"] = "https://example.test/patient"; bundle["entry"] = entries
        }))
    }

    func testStrictJsonAndCollectionOwnershipRejectedBeforeSaving() throws {
        let bytes = try body(), text = String(decoding: bytes, as: UTF8.self)
        for invalid in [text + " {}", String(text.dropLast()) + ",}", "{\"type\":\"collection\"," + text.dropFirst()] {
            XCTAssertThrowsError(try verify(Data(invalid.utf8)))
        }
        XCTAssertThrowsError(try verify(Data([0xc3, 0x28])))
        for invalid in [
            #"{"collection":"patient","records":{"patientId":"other"}}"#,
            #"{"collection":"patient","records":{"patientId":1}}"#,
            #"{"collection":"patient","records":{"patientId":"test-patient","patientId":"test-patient"}}"#,
            #"{"collection":"patient","records":{"patientId":"test-patient","x":[{"a":1,"\u0061":2}]}}"#,
            #"{"collection":"patient","records":{"patientId":"test-patient","name":"\ud800"}}"#,
            #"{"collection":"patient","records":{"patientId":"test-patient",}}"#,
            #"{"collection":"patient","records":[]}"#,
            #"{"collection":"unexpected","records":[]}"#
        ] { XCTAssertThrowsError(try verify(payload(invalid))) }
    }
}
