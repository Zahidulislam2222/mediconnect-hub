import Foundation
import XCTest
@testable import MediConnectApp

private final class SettingsRecordingProtocol: URLProtocol {
    private static let lock = NSLock()
    private static var captured: [URLRequest] = []
    static func drain() -> [URLRequest] {
        lock.lock(); defer { lock.unlock() }
        let result = captured; captured = []; return result
    }
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        var capturedRequest = request
        if capturedRequest.httpBody == nil, let stream = request.httpBodyStream {
            stream.open(); defer { stream.close() }
            var data = Data()
            var buffer = [UInt8](repeating: 0, count: 1024)
            while true {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count < 0 {
                    client?.urlProtocol(self, didFailWithError: URLError(.cannotDecodeContentData)); return
                }
                if count == 0 { break }
                data.append(contentsOf: buffer.prefix(count))
            }
            capturedRequest.httpBody = data
        }
        Self.lock.lock(); Self.captured.append(capturedRequest); Self.lock.unlock()
        guard let url = request.url,
              let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: [:]) else {
            client?.urlProtocol(self, didFailWithError: URLError(.badURL)); return
        }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        let body = request.httpMethod == "GET"
            ? #"{"patientId":"test-patient","name":"Test Patient","email":"test@example.invalid"}"# : "{}"
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

final class PatientSettingsTransportTests: XCTestCase {
    override func setUp() { super.setUp(); _ = SettingsRecordingProtocol.drain() }
    private var identity: Identity {
        Identity(subject: "test-patient", role: .patient, expiresAt: Date().addingTimeInterval(300))
    }
    private func contract() throws -> MobileContract {
        try MobileContract(data: BundledAssets.data("mobile-contract"), policy: BundledAssets.data("session-policy"))
    }
    private func api(_ residency: String = "US") throws -> NativeAPI {
        let awsRegion = residency == "US" ? "us-east-1" : "eu-central-1"
        let source: [String: Any] = ["requestTimeoutSeconds": 10, "maxResponseBytes": 1048576,
            "regions": [residency: ["awsRegion": awsRegion, "userPoolId": awsRegion + "_testpool",
                "clientId": "testclient", "issuer": "https://example.test/testpool",
                "services": ["patient": "https://example.test"]]]]
        let config = try MobileConfiguration(data: JSONSerialization.data(withJSONObject: source), residency: residency)
        return NativeAPI(config: config, protocolClasses: [SettingsRecordingProtocol.self])
    }

    @MainActor func testOwnProfileGetAndChangedFieldsPutUseFreshRegionalSession() async throws {
        for region in ["US", "EU"] {
            var fetches = 0
            let owner = identity
            let contract = try contract()
            let client = try PatientSettingsAPI(transport: api(region), contract: contract, fetch: {
                fetches += 1
                return SessionAccess(identity: owner, token: "test-token")
            })
            let snapshot = try await client.load(identity: owner)
            XCTAssertNil(snapshot.phone); XCTAssertNil(snapshot.address); XCTAssertNil(snapshot.preferences)
            var draft = PatientSettingsDraft(snapshot: snapshot); draft.name = "Changed Patient"
            try await client.save(identity: owner, snapshot: snapshot, draft: draft)
            let sent = SettingsRecordingProtocol.drain()
            XCTAssertEqual(fetches, 2); XCTAssertEqual(sent.count, 2)
            XCTAssertEqual(sent.map(\.httpMethod), ["GET", "PUT"])
            let route = try XCTUnwrap(contract.profiles[Role.patient.rawValue])
            XCTAssertEqual(sent.first?.url?.path, route.readPath + (route.appendSubject ? "/" + owner.subject : ""))
            XCTAssertEqual(sent.last?.url?.path, contract.patientSettings.updatePath + "/" + owner.subject)
            for request in sent {
                XCTAssertEqual(request.value(forHTTPHeaderField: "x-user-region"), region)
                XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer test-token")
            }
            let body = try JSONSerialization.jsonObject(with: XCTUnwrap(sent.last?.httpBody)) as? [String: String]
            XCTAssertEqual(body, ["name": "Changed Patient"])
        }
    }
    @MainActor func testNoOpSaveDoesNotFetchSessionOrSendRequest() async throws {
        var fetches = 0
        let owner = identity
        let client = try PatientSettingsAPI(transport: api(), contract: contract(), fetch: {
            fetches += 1; return SessionAccess(identity: owner, token: "test-token")
        })
        let snapshot = PatientSettingsSnapshot(subject: owner.subject, name: "Test Patient", email: "test@example.invalid",
                                               phone: nil, address: nil, preferences: nil)
        try await client.save(identity: owner, snapshot: snapshot, draft: PatientSettingsDraft(snapshot: snapshot))
        XCTAssertEqual(fetches, 0); XCTAssertTrue(SettingsRecordingProtocol.drain().isEmpty)
    }
    @MainActor func testForeignSnapshotAndNonPatientRejectBeforeSessionFetch() async throws {
        var fetches = 0
        let owner = identity
        let client = try PatientSettingsAPI(transport: api(), contract: contract(), fetch: {
            fetches += 1; return SessionAccess(identity: owner, token: "test-token")
        })
        let foreign = PatientSettingsSnapshot(subject: "test-other", name: "Test Other", email: "other@example.invalid",
                                              phone: nil, address: nil, preferences: nil)
        var draft = PatientSettingsDraft(snapshot: foreign); draft.name = "Changed Other"
        do { try await client.save(identity: owner, snapshot: foreign, draft: draft); XCTFail("Foreign profile accepted") }
        catch MobileFailure.forbidden {}
        let doctor = Identity(subject: owner.subject, role: .doctor, expiresAt: owner.expiresAt)
        do { _ = try await client.load(identity: doctor); XCTFail("Non-patient settings accepted") }
        catch MobileFailure.forbidden {}
        XCTAssertEqual(fetches, 0); XCTAssertTrue(SettingsRecordingProtocol.drain().isEmpty)
    }
    @MainActor func testChangedSDKIdentityRejectsBeforeNetwork() async throws {
        let owner = identity
        let changed = Identity(subject: "test-other", role: .patient, expiresAt: owner.expiresAt)
        let client = try PatientSettingsAPI(transport: api(), contract: contract(), fetch: {
            SessionAccess(identity: changed, token: "test-token")
        })
        do { _ = try await client.load(identity: owner); XCTFail("Changed SDK identity accepted") }
        catch MobileFailure.session {}
        XCTAssertTrue(SettingsRecordingProtocol.drain().isEmpty)
    }
}
