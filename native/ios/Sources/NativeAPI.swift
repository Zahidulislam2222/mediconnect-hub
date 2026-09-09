import Foundation

final class RejectRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

final class NativeAPI {
    private let config: MobileConfiguration
    private let session: URLSession
    init(config: MobileConfiguration) {
        self.config = config
        let settings = URLSessionConfiguration.ephemeral
        settings.urlCache = nil
        settings.httpCookieStorage = nil
        settings.httpShouldSetCookies = false
        settings.requestCachePolicy = .reloadIgnoringLocalCacheData
        settings.timeoutIntervalForRequest = config.requestTimeoutSeconds
        settings.timeoutIntervalForResource = config.requestTimeoutSeconds
        session = URLSession(configuration: settings, delegate: RejectRedirects(), delegateQueue: nil)
    }
    deinit { session.invalidateAndCancel() }

    func request(access: SessionAccess, service: String, path: String, query: [String: String] = [:], body: [String: Any]? = nil) async throws -> Data {
        guard access.identity.expiresAt > Date(), let base = config.services[service],
              var url = URLComponents(url: base, resolvingAgainstBaseURL: false),
              path.range(of: "^/[A-Za-z0-9/_.-]+$", options: .regularExpression) != nil,
              !path.contains("//"), !path.split(separator: "/").contains("..") else { throw MobileFailure.forbidden }
        url.path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + path
        if !url.path.hasPrefix("/") { url.path = "/" + url.path }
        url.queryItems = query.isEmpty ? nil : query.map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let endpoint = url.url else { throw MobileFailure.configuration }
        var request = URLRequest(url: endpoint)
        request.httpMethod = body == nil ? "GET" : "POST"
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
        guard (200..<300).contains(response.statusCode) else { throw HTTPFailure(status: response.statusCode) }
        guard response.expectedContentLength <= config.maxResponseBytes else { throw MobileFailure.response }
        var data = Data()
        for try await byte in bytes {
            try Task.checkCancellation()
            guard data.count < config.maxResponseBytes else { throw MobileFailure.response }
            data.append(byte)
        }
        return data
    }
}
