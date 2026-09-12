import CryptoKit
import Foundation
import XCTest
@testable import MediConnectApp

final class ExportIntegrityTests: XCTestCase {
    private func digest(_ bytes: Data) -> String {
        SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    }

    func testKnownDigestAndUppercaseAreAccepted() throws {
        let bytes = Data("abc".utf8)
        let known = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        for header in [known, known.uppercased()] {
            XCTAssertEqual(try ExportIntegrity.verifiedBytes(NativeResponse(body: bytes, status: 200, exportIntegrity: header)), bytes)
        }
    }

    func testExactBytesWithoutJsonOrUnicodeNormalization() throws {
        for bytes in [Data("{ \"text\": \"é বাংলা\" }\n".utf8), Data([0xc3, 0x28])] {
            XCTAssertEqual(try ExportIntegrity.verifiedBytes(NativeResponse(body: bytes, status: 200, exportIntegrity: digest(bytes))), bytes)
        }
        XCTAssertThrowsError(try ExportIntegrity.verifiedBytes(NativeResponse(
            body: Data("{ \"x\": 1 }".utf8), status: 200, exportIntegrity: digest(Data("{\"x\":1}".utf8)))))
    }

    func testMissingMalformedTamperedHeadersAndWrongStatusRejected() {
        let bytes = Data("abc".utf8)
        let hash = digest(bytes)
        let headers: [String?] = [nil, "", " " + hash, hash + " ", hash + "," + hash,
            String(hash.dropFirst()), String(repeating: "g", count: 64), String(repeating: "０", count: 64), String(repeating: "0", count: 64)]
        for header in headers {
            XCTAssertThrowsError(try ExportIntegrity.verifiedBytes(NativeResponse(body: bytes, status: 200, exportIntegrity: header)))
        }
        for status in [201, 204, 206, 400, 503] {
            XCTAssertThrowsError(try ExportIntegrity.verifiedBytes(NativeResponse(body: bytes, status: status, exportIntegrity: hash)))
        }
        XCTAssertThrowsError(try ExportIntegrity.verifiedBytes(NativeResponse(body: Data(), status: 200, exportIntegrity: digest(Data()))))
    }
}
