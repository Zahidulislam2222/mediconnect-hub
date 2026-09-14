import Foundation

/// Validates the supported application collection profile, not arbitrary clinical FHIR.
enum PatientExportBundle {
    static func verifiedBytes(_ response: NativeResponse, identity: Identity,
                              contract: PatientExportContract, subjectField: String, maxBytes: Int) throws -> Data {
        do {
            guard identity.role == .patient, !identity.subject.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  identity.expiresAt > Date() else { throw MobileFailure.response }
            let bytes = try ExportIntegrity.verifiedBytes(response)
            guard maxBytes > 0, bytes.count <= maxBytes else { throw MobileFailure.response }
            let bundle = try object(bytes, depth: contract.maxJsonDepth)
            guard Set(bundle.keys) == ["resourceType", "type", "timestamp", "entry"],
                  bundle["resourceType"] as? String == "Bundle", bundle["type"] as? String == "collection",
                  let timestamp = bundle["timestamp"] as? String,
                  let entries = bundle["entry"] as? [[String: Any]], entries.count == contract.collections.count
            else { throw MobileFailure.response }
            let date = ISO8601DateFormatter()
            date.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if date.date(from: timestamp) == nil {
                date.formatOptions = [.withInternetDateTime]
                guard date.date(from: timestamp) != nil else { throw MobileFailure.response }
            }
            var identifiers = Set<String>(), collections = Set<String>()
            for entry in entries {
                guard Set(entry.keys) == ["fullUrl", "resource"], let resource = entry["resource"] as? [String: Any],
                      Set(resource.keys) == ["resourceType", "id", "contentType", "data"],
                      resource["resourceType"] as? String == "Binary", resource["contentType"] as? String == "application/json",
                      let id = resource["id"] as? String, UUID(uuidString: id)?.uuidString.lowercased() == id,
                      identifiers.insert(id).inserted, entry["fullUrl"] as? String == "urn:uuid:" + id,
                      let encoded = resource["data"] as? String, let decoded = Data(base64Encoded: encoded),
                      decoded.base64EncodedString() == encoded else { throw MobileFailure.response }
                let collection = try object(decoded, depth: contract.maxJsonDepth)
                guard Set(collection.keys) == ["collection", "records"], let name = collection["collection"] as? String,
                      contract.collections.contains(name), collections.insert(name).inserted else { throw MobileFailure.response }
                if name == contract.ownerCollection {
                    guard let patient = collection["records"] as? [String: Any],
                          patient[subjectField] as? String == identity.subject else { throw MobileFailure.response }
                } else if !(collection["records"] is [Any]) { throw MobileFailure.response }
            }
            guard collections == Set(contract.collections) else { throw MobileFailure.response }
            return bytes
        } catch { throw MobileFailure.response }
    }

    private static func object(_ data: Data, depth: Int) throws -> [String: Any] {
        var parser = StrictExportJSON(data: data)
        try parser.validate(maxDepth: depth)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw MobileFailure.response }
        return object
    }
}

/// RFC 8259 grammar checked before Foundation can discard duplicate object members.
private struct StrictExportJSON {
    private enum State { case objectStart, key, colon, value, objectEnd, arrayStart, arrayValue, arrayEnd }
    private struct Frame { var state: State; var keys = Set<String>() }
    private let bytes: [UInt8]
    private var index = 0
    private var stack: [Frame] = []
    init(data: Data) { bytes = Array(data) }

    mutating func validate(maxDepth: Int) throws {
        guard maxDepth > 0, String(bytes: bytes, encoding: .utf8) != nil else { throw MobileFailure.response }
        try value(maxDepth: maxDepth)
        while !stack.isEmpty {
            whitespace()
            let top = stack.count - 1
            switch stack[top].state {
            case .objectStart:
                if take(125) { stack.removeLast() } else { stack[top].state = .key }
            case .key:
                let key = try string()
                guard stack[top].keys.insert(key).inserted else { throw MobileFailure.response }
                stack[top].state = .colon
            case .colon:
                guard take(58) else { throw MobileFailure.response }; stack[top].state = .value
            case .value:
                stack[top].state = .objectEnd; try value(maxDepth: maxDepth)
            case .objectEnd:
                if take(125) { stack.removeLast() }
                else if take(44) { stack[top].state = .key }
                else { throw MobileFailure.response }
            case .arrayStart:
                if take(93) { stack.removeLast() } else { stack[top].state = .arrayValue }
            case .arrayValue:
                stack[top].state = .arrayEnd; try value(maxDepth: maxDepth)
            case .arrayEnd:
                if take(93) { stack.removeLast() }
                else if take(44) { stack[top].state = .arrayValue }
                else { throw MobileFailure.response }
            }
        }
        whitespace()
        guard index == bytes.count else { throw MobileFailure.response }
    }

    private mutating func value(maxDepth: Int) throws {
        whitespace()
        guard index < bytes.count else { throw MobileFailure.response }
        switch bytes[index] {
        case 123, 91:
            let state: State = bytes[index] == 123 ? .objectStart : .arrayStart
            guard stack.count < maxDepth else { throw MobileFailure.response }
            index += 1; stack.append(Frame(state: state))
        case 34: _ = try string()
        case 116: try literal("true")
        case 102: try literal("false")
        case 110: try literal("null")
        default:
            let start = index
            while index < bytes.count && ![9, 10, 13, 32, 44, 93, 125].contains(bytes[index]) { index += 1 }
            let number = String(decoding: bytes[start..<index], as: UTF8.self)
            guard number.range(of: "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?([eE][+-]?[0-9]+)?$", options: .regularExpression) != nil,
                  let value = Double(number), value.isFinite else { throw MobileFailure.response }
        }
    }

    private mutating func string() throws -> String {
        let start = index
        guard take(34) else { throw MobileFailure.response }
        while index < bytes.count {
            let byte = bytes[index]; index += 1
            if byte == 34 { return try JSONDecoder().decode(String.self, from: Data(bytes[start..<index])) }
            guard byte >= 32 else { throw MobileFailure.response }
            if byte == 92 {
                guard index < bytes.count else { throw MobileFailure.response }
                let escape = bytes[index]; index += 1
                if escape == 117 {
                    let unit = try hexUnit()
                    if (0xD800...0xDBFF).contains(unit) {
                        guard take(92), take(117), (0xDC00...0xDFFF).contains(try hexUnit()) else { throw MobileFailure.response }
                    } else if (0xDC00...0xDFFF).contains(unit) { throw MobileFailure.response }
                } else if ![34, 92, 47, 98, 102, 110, 114, 116].contains(escape) { throw MobileFailure.response }
            }
        }
        throw MobileFailure.response
    }

    private mutating func hexUnit() throws -> UInt16 {
        guard index + 4 <= bytes.count else { throw MobileFailure.response }
        let digits = bytes[index..<index + 4]
        guard digits.allSatisfy({ (48...57).contains($0) || (65...70).contains($0) || (97...102).contains($0) }),
              let value = UInt16(String(decoding: digits, as: UTF8.self), radix: 16) else { throw MobileFailure.response }
        index += 4; return value
    }
    private mutating func literal(_ text: String) throws {
        for byte in text.utf8 { guard take(byte) else { throw MobileFailure.response } }
    }
    private mutating func take(_ byte: UInt8) -> Bool {
        guard index < bytes.count, bytes[index] == byte else { return false }
        index += 1; return true
    }
    private mutating func whitespace() {
        while index < bytes.count && [9, 10, 13, 32].contains(bytes[index]) { index += 1 }
    }
}
