import Combine
import XCTest
@testable import MediConnectApp

final class PasswordRecoveryTests: XCTestCase {
    @MainActor private final class Fake: PasswordRecoveryService {
        var requests = 0
        var confirmations = 0
        var username: String?
        var request: () async throws -> Bool = { false }
        var confirm: () async throws -> Void = {}
        func requestReset(username: String) async throws -> Bool {
            requests += 1; self.username = username
            return try await request()
        }
        func confirmReset(username: String, password: String, code: String) async throws {
            confirmations += 1
            XCTAssertEqual(self.username, username)
            XCTAssertTrue(password == " test-password ")
            XCTAssertTrue(code == "123456")
            try await confirm()
        }
    }

    @MainActor private func observe(_ model: PasswordRecovery, until predicate: @escaping (RecoveryState) -> Bool,
                                    action: () -> Void) async {
        let changed = expectation(description: "Recovery reaches expected state")
        let observation = model.$state.filter(predicate).prefix(1).sink { _ in changed.fulfill() }
        action()
        await fulfillment(of: [changed], timeout: 5)
        observation.cancel()
    }

    @MainActor func testRequestConfirmationAndCompletion() async {
        let service = Fake(); let model = PasswordRecovery(service: service); model.open()
        await observe(model, until: { $0.step == .confirm && !$0.busy }) { model.request(" test-user@example.test ") }
        XCTAssertEqual(service.username, "test-user@example.test")
        model.request("another@example.test")
        await observe(model, until: { $0.step == .complete }) { model.confirm(password: " test-password ", code: " 123456 ") }
        model.confirm(password: " test-password ", code: "123456")
        XCTAssertEqual(service.requests, 1); XCTAssertEqual(service.confirmations, 1)
        model.close()
    }
    @MainActor func testAlreadyCompletedSDKResult() async {
        let service = Fake(); service.request = { true }
        let model = PasswordRecovery(service: service); model.open()
        await observe(model, until: { $0.step == .complete }) { model.request("test-user@example.test") }
        XCTAssertEqual(service.confirmations, 0); model.close()
    }
    @MainActor func testMissingConfigurationAndEmptyInput() {
        let blocked = PasswordRecovery(service: nil); blocked.open()
        XCTAssertEqual(blocked.state, RecoveryState())
        let service = Fake(); let model = PasswordRecovery(service: service); model.open()
        model.request(" "); model.confirm(password: "", code: "")
        XCTAssertEqual(service.requests, 0); XCTAssertEqual(service.confirmations, 0); model.close()
    }
    @MainActor func testRequestAndConfirmationFailuresCanRetry() async {
        let service = Fake(); service.request = { throw MobileFailure.session }
        let model = PasswordRecovery(service: service); model.open()
        await observe(model, until: { $0.failed && !$0.busy }) { model.request("test-user@example.test") }
        XCTAssertEqual(model.state.step, .request)
        service.request = { false }
        await observe(model, until: { $0.step == .confirm && !$0.busy }) { model.request("test-user@example.test") }
        service.confirm = { throw MobileFailure.session }
        await observe(model, until: { $0.failed && !$0.busy }) { model.confirm(password: " test-password ", code: "123456") }
        XCTAssertEqual(model.state.step, .confirm)
        service.confirm = {}
        await observe(model, until: { $0.step == .complete }) { model.confirm(password: " test-password ", code: "123456") }
        model.close()
    }
    @MainActor func testDuplicateRequestAndLateResponseAfterCancel() async {
        let service = Fake()
        let started = expectation(description: "Request started")
        let returned = expectation(description: "Cancelled provider request returned")
        var pending: CheckedContinuation<Bool, Never>?
        service.request = {
            let result = await withCheckedContinuation { continuation in pending = continuation; started.fulfill() }
            returned.fulfill()
            return result
        }
        let model = PasswordRecovery(service: service); model.open()
        model.request("test-user@example.test"); model.request("test-user@example.test")
        await fulfillment(of: [started], timeout: 5)
        XCTAssertEqual(service.requests, 1)
        model.close(); model.open(); pending?.resume(returning: false)
        await fulfillment(of: [returned], timeout: 5)
        await Task.yield()
        XCTAssertEqual(model.state, RecoveryState(step: .request))
        model.confirm(password: " test-password ", code: "123456")
        XCTAssertEqual(service.confirmations, 0); model.close()
    }
}
