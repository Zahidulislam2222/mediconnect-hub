import CryptoKit
import Foundation

/// Checks the backend wire checksum, not FHIR validity, ownership or a digital signature.
enum ExportIntegrity {
    private static let digestHexLength = SHA256.byteCount * 2

    static func verifiedBytes(_ response: NativeResponse) throws -> Data {
        guard response.status == 200, !response.body.isEmpty,
              let header = response.exportIntegrity,
              header.utf8.count == digestHexLength,
              header.utf8.allSatisfy({ (0x30...0x39).contains($0) || (0x41...0x46).contains($0) || (0x61...0x66).contains($0) }) else {
            throw MobileFailure.response
        }
        let actual = SHA256.hash(data: response.body).map { String(format: "%02x", $0) }.joined()
        guard actual == header.lowercased() else { throw MobileFailure.response }
        return response.body
    }
}
