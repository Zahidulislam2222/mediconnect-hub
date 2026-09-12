import Foundation
import XCTest
@testable import MediConnectApp

private final class MethodRecordingProtocol: URLProtocol {
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
        guard let url = request.url else { return }
        if url.path.hasPrefix("/failure/") {
            let pieces = url.path.split(separator: "/")
            let status = Int(pieces[1]) ?? 503
            let payload = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "body" })?.value ?? ""
            let headers = pieces.count > 2 ? ["Content-Length": String(payload.utf8.count)] : [:]
            let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: headers)!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(payload.utf8))
            client?.urlProtocolDidFinishLoading(self)
            return
        }
        guard let response = HTTPURLResponse(url: url, statusCode: url.path == "/metadata" ? 202 : (url.path == "/rejected" ? 409 : 200), httpVersion: nil,
                                             headerFields: url.path == "/metadata" ? ["x-export-integrity": "test-unverified-integrity"] : [:]) else {
            client?.urlProtocol(self, didFailWithError: URLError(.badURL)); return
        }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data("{}".utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

final class NativeMethodsTransportTests: XCTestCase {
    override func setUp() { super.setUp(); _ = MethodRecordingProtocol.drain() }
    private var access: SessionAccess {
        SessionAccess(identity: Identity(subject: "test-patient", role: .patient,
                                        expiresAt: Date().addingTimeInterval(300)), token: "test-token")
    }
    private func api(_ residency: String = "US", maxBytes: Int = 1048576) throws -> NativeAPI {
        let awsRegion = residency == "US" ? "us-east-1" : "eu-central-1"
        let source: [String: Any] = ["requestTimeoutSeconds": 10, "maxResponseBytes": maxBytes,
            "regions": [residency: ["awsRegion": awsRegion, "userPoolId": awsRegion + "_testpool",
                "clientId": "testclient", "issuer": "https://example.test/testpool",
                "services": ["patient": "https://example.test"]]]]
        let config = try MobileConfiguration(data: JSONSerialization.data(withJSONObject: source), residency: residency)
        return NativeAPI(config: config, protocolClasses: [MethodRecordingProtocol.self])
    }
    func testExplicitMethodsAndRegionalHeadersThroughURLSession() async throws {
        for region in ["US", "EU"] {
            for method in [NativeHTTPMethod.get, .post, .put, .delete] {
                let body: [String: Any]? = method == .get ? nil : ["name": "Test person"]
                _ = try await api(region).request(access: access, service: "patient", path: "/me", body: body, method: method)
                let sent = try XCTUnwrap(MethodRecordingProtocol.drain().first)
                XCTAssertEqual(sent.httpMethod, method.rawValue)
                XCTAssertEqual(sent.url?.path, "/me")
                XCTAssertEqual(sent.value(forHTTPHeaderField: "x-user-region"), region)
                XCTAssertEqual(sent.value(forHTTPHeaderField: "Authorization"), "Bearer test-token")
                XCTAssertEqual(sent.value(forHTTPHeaderField: "Cache-Control"), "no-store")
                if body != nil {
                    let decoded = try JSONSerialization.jsonObject(with: XCTUnwrap(sent.httpBody)) as? [String: String]
                    XCTAssertEqual(decoded, ["name": "Test person"])
                    XCTAssertEqual(sent.value(forHTTPHeaderField: "Content-Type"), "application/json")
                } else { XCTAssertTrue(sent.httpBody?.isEmpty ?? true) }
            }
        }
    }
    func testDeleteWithoutBodyAndLegacyInference() async throws {
        let client = try api()
        _ = try await client.request(access: access, service: "patient", path: "/me", method: .delete)
        _ = try await client.request(access: access, service: "patient", path: "/me")
        _ = try await client.request(access: access, service: "patient", path: "/me", body: [:])
        let sent = MethodRecordingProtocol.drain()
        XCTAssertEqual(sent.map(\.httpMethod), ["DELETE", "GET", "POST"])
        XCTAssertTrue(sent.first?.httpBody?.isEmpty ?? true)
    }
    func testInvalidCombinationsNeverReachURLSession() async throws {
        let client = try api()
        let cases: [(NativeHTTPMethod, [String: Any]?)] = [(.get, [:]), (.post, nil), (.put, nil)]
        for (method, body) in cases {
            do {
                _ = try await client.request(access: access, service: "patient", path: "/me", body: body, method: method)
                XCTFail("Invalid method/body pair accepted")
            } catch MobileFailure.configuration {} catch { XCTFail("Unexpected error type") }
        }
        XCTAssertTrue(MethodRecordingProtocol.drain().isEmpty)
    }
    func testSuccessfulResponseMetadataAndAbsentHeader() async throws {
        for region in ["US", "EU"] {
            let client = try api(region)
            let response = try await client.requestResponse(access: access, service: "patient", path: "/metadata")
            XCTAssertEqual(response.status, 202)
            XCTAssertEqual(response.body, Data("{}".utf8))
            XCTAssertEqual(response.exportIntegrity, "test-unverified-integrity")
            let absent = try await client.requestResponse(access: access, service: "patient", path: "/me")
            XCTAssertEqual(absent.status, 200)
            XCTAssertNil(absent.exportIntegrity)
        }
    }
    func testMetadataEntryStillRejectsNonSuccess() async throws {
        do {
            _ = try await api().requestResponse(access: access, service: "patient", path: "/rejected")
            XCTFail("Non-success response accepted")
        } catch let failure as HTTPFailure { XCTAssertEqual(failure.status, 409) }
    }

    func testPrivacyFailuresExposeOnlyKnownStatusAndCodePairs() async throws {
        let cases: [(Int, String, NativeFailureOutcome?)] = [
            (409, #"{"status":"IN_PROGRESS"}"#, .erasureInProgress),
            (409, #"{"status":"REQUEST_CHANGED"}"#, .erasureRequestChanged),
            (503, #"{"status":"RETRY_REQUIRED","code":"ERASURE_INCOMPLETE"}"#, .erasureRetryRequired),
            (503, #"{"code":"DATA_EXPORT_INCOMPLETE"}"#, .exportIncomplete),
            (401, #"{"status":"IN_PROGRESS"}"#, nil),
            (409, #"{"status":true}"#, nil),
            (409, #"{"status":"UNKNOWN"}"#, nil),
            (409, #"{"status":"IN_PROGRESS","code":"DATA_EXPORT_INCOMPLETE"}"#, nil),
            (503, #"{"code":"ERASURE_INCOMPLETE"}"#, nil),
            (503, #"{"status":null,"code":"DATA_EXPORT_INCOMPLETE"}"#, nil),
            (503, "not-json", nil),
            (409, #"{"status":"IN_PROGRESS"} trailing"#, nil),
            (409, #"{status:'IN_PROGRESS'}"#, nil),
            (409, #"{"status":"IN_PROGRESS",}"#, nil),
            (409, #"{"status":"REQUEST_CHANGED","status":"IN_PROGRESS"}"#, nil),
            (409, #"{"status":"IN_PROGRESS","ignored":[1,]}"#, nil)
        ]
        for region in ["US", "EU"] {
            for (status, body, outcome) in cases {
                do {
                    _ = try await api(region).request(access: access, service: "patient", path: "/failure/" + String(status), query: ["body": body])
                    XCTFail("Non-success accepted")
                } catch let failure as HTTPFailure {
                    XCTAssertEqual(failure.status, status)
                    XCTAssertEqual(failure.outcome, outcome)
                }
            }
        }
    }
    func testOversizedErrorBodiesPreserveStatusWithoutOutcome() async throws {
        for region in ["US", "EU"] {
            for suffix in ["", "/length"] {
                do {
                    _ = try await api(region, maxBytes: 4).request(access: access, service: "patient", path: "/failure/409" + suffix, query: ["body": #"{"status":"IN_PROGRESS"}"#])
                    XCTFail("Oversized error accepted")
                } catch let failure as HTTPFailure {
                    XCTAssertEqual(failure.status, 409)
                    XCTAssertNil(failure.outcome)
                }
            }
        }
    }

    func testInvalidUTF8DoesNotExposeOutcome() {
        var body = Data(#"{"status":"IN_PROGRESS","ignored":""#.utf8)
        body.append(0xff)
        body.append(contentsOf: #""}"#.utf8)
        XCTAssertNil(NativeFailureOutcome.decode(status: 409, data: body))
    }
}
