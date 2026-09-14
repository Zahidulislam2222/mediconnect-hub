import Foundation

final class RejectRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

enum NativeHTTPMethod: String {
    case get = "GET", post = "POST", put = "PUT", delete = "DELETE"
}

// Fixed backend wire outcomes; arbitrary server text is never retained in failures.
enum NativeFailureOutcome {
    case erasureInProgress, erasureRequestChanged, erasureRetryRequired, exportIncomplete

    static func decode(status: Int, data: Data) -> NativeFailureOutcome? {
        guard hasUnambiguousJSONStructure(data) else { return nil }
        guard let value = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return nil }
        let state = value["status"] as? String
        let code = value["code"] as? String
        if status == 409 && value["code"] == nil {
            if state == "IN_PROGRESS" { return .erasureInProgress }
            if state == "REQUEST_CHANGED" { return .erasureRequestChanged }
        }
        if status == 503 && state == "RETRY_REQUIRED" && code == "ERASURE_INCOMPLETE" { return .erasureRetryRequired }
        if status == 503 && value["status"] == nil && code == "DATA_EXPORT_INCOMPLETE" { return .exportIncomplete }
        return nil
    }

    // Foundation supplies value/escape validation. Reject syntax it can normalize
    // away before decoding: duplicate top-level keys and trailing commas.
    private static func hasUnambiguousJSONStructure(_ data: Data) -> Bool {
        guard String(data: data, encoding: .utf8) != nil else { return false }
        let bytes = Array(data)
        var depth = 0
        var previous: UInt8?
        var stringStart: Int?
        var lastString: Range<Int>?
        var escaped = false
        var names = Set<String>()
        for (index, byte) in bytes.enumerated() {
            if let start = stringStart {
                if byte < 0x20 { return false }
                if escaped { escaped = false }
                else if byte == 0x5c { escaped = true }
                else if byte == 0x22 {
                    stringStart = nil
                    lastString = start..<(index + 1)
                    previous = byte
                }
                continue
            }
            if byte == 0x20 || byte == 0x09 || byte == 0x0a || byte == 0x0d { continue }
            switch byte {
            case 0x22: stringStart = index
            case 0x7b, 0x5b: depth += 1
            case 0x7d, 0x5d:
                if previous == 0x2c { return false }
                depth -= 1
            case 0x3a where depth == 1:
                guard previous == 0x22, let range = lastString,
                      let name = (try? JSONSerialization.jsonObject(
                        with: Data(bytes[range]), options: [.fragmentsAllowed])) as? String,
                      names.insert(name).inserted else { return false }
            default: break
            }
            previous = byte
        }
        return stringStart == nil && depth == 0
    }
}

struct NativeResponse {
    let body: Data
    let status: Int
    let exportIntegrity: String?
}

final class NativeAPI {
    private let config: MobileConfiguration
    private let session: URLSession
    init(config: MobileConfiguration, protocolClasses: [AnyClass]? = nil) {
        self.config = config
        let settings = URLSessionConfiguration.ephemeral
        if let protocolClasses { settings.protocolClasses = protocolClasses }
        settings.urlCache = nil
        settings.httpCookieStorage = nil
        settings.httpShouldSetCookies = false
        settings.requestCachePolicy = .reloadIgnoringLocalCacheData
        settings.timeoutIntervalForRequest = config.requestTimeoutSeconds
        settings.timeoutIntervalForResource = config.requestTimeoutSeconds
        session = URLSession(configuration: settings, delegate: RejectRedirects(), delegateQueue: nil)
    }
    deinit { session.invalidateAndCancel() }

    func request(access: SessionAccess, service: String, path: String, query: [String: String] = [:], body: [String: Any]? = nil, method: NativeHTTPMethod? = nil) async throws -> Data {
        let response = try await requestResponse(access: access, service: service, path: path, query: query, body: body, method: method)
        return response.body
    }

    func requestResponse(access: SessionAccess, service: String, path: String, query: [String: String] = [:], body: [String: Any]? = nil, method: NativeHTTPMethod? = nil) async throws -> NativeResponse {
        let selectedMethod = method ?? (body == nil ? .get : .post)
        switch selectedMethod {
        case .get: guard body == nil else { throw MobileFailure.configuration }
        case .post, .put: guard body != nil else { throw MobileFailure.configuration }
        case .delete: break
        }
        guard access.identity.expiresAt > Date(), let base = config.services[service],
              var url = URLComponents(url: base, resolvingAgainstBaseURL: false),
              path.range(of: "^/[A-Za-z0-9/_.-]+$", options: .regularExpression) != nil,
              !path.contains("//"), !path.split(separator: "/").contains("..") else { throw MobileFailure.forbidden }
        url.path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + path
        if !url.path.hasPrefix("/") { url.path = "/" + url.path }
        url.queryItems = query.isEmpty ? nil : query.map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let endpoint = url.url else { throw MobileFailure.configuration }
        var request = URLRequest(url: endpoint)
        request.httpMethod = selectedMethod.rawValue
        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        request.setValue("Bearer " + access.token, forHTTPHeaderField: "Authorization")
        request.setValue(config.residency, forHTTPHeaderField: "x-user-region")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        let (bytes, response) = try await session.bytes(for: request)
        defer { bytes.task.cancel() }
        guard let response = response as? HTTPURLResponse else { throw HTTPFailure(status: nil) }
        let successful = (200..<300).contains(response.statusCode)
        var data = Data()
        do {
            guard response.expectedContentLength <= config.maxResponseBytes else { throw MobileFailure.response }
            for try await byte in bytes {
                try Task.checkCancellation()
                guard data.count < config.maxResponseBytes else { throw MobileFailure.response }
                data.append(byte)
            }
        } catch {
            try Task.checkCancellation()
            if !successful { throw HTTPFailure(status: response.statusCode) }
            throw error
        }
        try Task.checkCancellation()
        if !successful {
            throw HTTPFailure(status: response.statusCode,
                              outcome: NativeFailureOutcome.decode(status: response.statusCode, data: data))
        }
        return NativeResponse(body: data, status: response.statusCode,
                              exportIntegrity: response.value(forHTTPHeaderField: "X-Export-Integrity"))
    }
}
