import Foundation
import XCTest
@testable import MediConnectApp

private final class ExportRecordingProtocol: URLProtocol {
    private static let lock = NSLock()
    private static var body = Data()
    private static var integrity = ""
    private static var requests: [URLRequest] = []
    static func configure(body: Data, integrity: String) {
        lock.lock(); defer { lock.unlock() }
        self.body = body; self.integrity = integrity; requests = []
    }
    static func captured() -> [URLRequest] { lock.lock(); defer { lock.unlock() }; return requests }
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.lock.lock()
        Self.requests.append(request)
        let body = Self.body, integrity = Self.integrity
        Self.lock.unlock()
        guard let url = request.url,
              let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil,
                                             headerFields: ["X-Export-Integrity": integrity]) else {
            client?.urlProtocol(self, didFailWithError: URLError(.badURL)); return
        }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

final class PatientExportTransportTests: XCTestCase {
    private struct Fixture: Decodable { let subject: String; let bodyBase64: String; let integrity: String }
    private func resource(_ name: String) throws -> Data {
        try Data(contentsOf: XCTUnwrap(Bundle(for: Self.self).url(forResource: name, withExtension: "json")))
    }
    private func fixture() throws -> Fixture { try JSONDecoder().decode(Fixture.self, from: resource("export-bundle")) }
    private func regions() throws -> [String: String] {
        let value = try XCTUnwrap(JSONSerialization.jsonObject(with: resource("export-transport")) as? [String: Any])
        return try XCTUnwrap(value["awsRegions"] as? [String: String])
    }
    private func contract() throws -> MobileContract {
        try MobileContract(data: resource("mobile-contract"), policy: resource("session-policy"))
    }
    private func configuration(_ residency: String) throws -> MobileConfiguration {
        var source = try XCTUnwrap(JSONSerialization.jsonObject(with: resource("mobile-config.example")) as? [String: Any])
        var configured = try XCTUnwrap(source["regions"] as? [String: [String: Any]])
        var region = try XCTUnwrap(configured[residency])
        let awsRegion = try XCTUnwrap(regions()[residency])
        region["awsRegion"] = awsRegion; region["userPoolId"] = awsRegion + "_testpool"
        region["clientId"] = "testclient"; region["issuer"] = "https://example.test/testpool"
        let patient = try XCTUnwrap(contract().profiles[Role.patient.rawValue])
        region["services"] = [patient.service: "https://example.test"]
        configured[residency] = region; source["regions"] = configured
        return try MobileConfiguration(data: JSONSerialization.data(withJSONObject: source), residency: residency)
    }
    @MainActor private func client(_ region: String, fetch: @escaping () async throws -> SessionAccess) throws -> PatientExportAPI {
        let config = try configuration(region)
        return try PatientExportAPI(transport: NativeAPI(config: config, protocolClasses: [ExportRecordingProtocol.self]),
                                    contract: contract(), maxResponseBytes: config.maxResponseBytes, fetch: fetch)
    }
    private func prepare(invalid: Bool = false) throws -> (Identity, Data) {
        let fixture = try fixture(), bytes = try XCTUnwrap(Data(base64Encoded: fixture.bodyBase64))
        ExportRecordingProtocol.configure(body: bytes, integrity: invalid ? "invalid" : fixture.integrity)
        return (Identity(subject: fixture.subject, role: .patient, expiresAt: .distantFuture), bytes)
    }

    @MainActor func testRegionalAuthenticatedRequestReturnsOriginalBytes() async throws {
        for region in try regions().keys {
            let (owner, bytes) = try prepare()
            var fetches = 0
            let api = try client(region) { fetches += 1; return SessionAccess(identity: owner, token: "test-token") }
            let result = try await api.download(identity: owner)
            XCTAssertEqual(result, bytes); XCTAssertEqual(fetches, 2)
            let requests = ExportRecordingProtocol.captured()
            XCTAssertEqual(requests.count, 1)
            XCTAssertEqual(requests.first?.httpMethod, "GET")
            XCTAssertEqual(requests.first?.url?.path, try contract().patientExport.path)
            XCTAssertEqual(requests.first?.value(forHTTPHeaderField: "Authorization"), "Bearer test-token")
            XCTAssertEqual(requests.first?.value(forHTTPHeaderField: "x-user-region"), region)
        }
    }

    @MainActor func testInvalidIntegrityNeverReturnsData() async throws {
        let (owner, _) = try prepare(invalid: true)
        let region = try XCTUnwrap(regions().keys.first)
        let api = try client(region) { SessionAccess(identity: owner, token: "test-token") }
        do { _ = try await api.download(identity: owner); XCTFail("Invalid export returned") }
        catch MobileFailure.response {}
    }

    @MainActor func testRefreshedForeignOrExpiredSessionRejectsCompletedDownload() async throws {
        let region = try XCTUnwrap(regions().keys.first)
        for expired in [false, true] {
            let (owner, _) = try prepare()
            var fetches = 0
            let replacement = Identity(subject: expired ? owner.subject : "other-patient", role: .patient,
                                       expiresAt: expired ? .distantPast : .distantFuture)
            let api = try client(region) {
                fetches += 1
                return SessionAccess(identity: fetches == 1 ? owner : replacement, token: "test-token")
            }
            do { _ = try await api.download(identity: owner); XCTFail("Changed session accepted") }
            catch MobileFailure.session {}
            XCTAssertEqual(fetches, 2)
        }
    }

    @MainActor func testCancellationDuringFinalSessionFetchCannotReturnData() async throws {
        let (owner, _) = try prepare()
        let region = try XCTUnwrap(regions().keys.first)
        var fetches = 0
        let api = try client(region) {
            fetches += 1
            if fetches == 2 { withUnsafeCurrentTask { $0?.cancel() } }
            return SessionAccess(identity: owner, token: "test-token")
        }
        let operation = Task { try await api.download(identity: owner) }
        do { _ = try await operation.value; XCTFail("Cancelled export returned") }
        catch is CancellationError {}
        XCTAssertEqual(fetches, 2)
    }
}
