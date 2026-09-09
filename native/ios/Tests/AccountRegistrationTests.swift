import Combine
import XCTest
@testable import MediConnectApp

final class AccountRegistrationTests: XCTestCase {
    @MainActor private final class Fake: RegistrationService {
        var registrations = 0; var confirmations = 0; var resends = 0
        var registration: () async throws -> Bool = { false }
        var confirmation: () async throws -> Bool = { true }
        var resend: () async throws -> Void = {}
        func register(username: String, password: String, name: String) async throws -> Bool {
            registrations += 1; XCTAssertEqual(username, "test-user@example.test")
            XCTAssertTrue(password == " test-password "); XCTAssertEqual(name, "Test person")
            return try await registration()
        }
        func confirmRegistration(username: String, code: String) async throws -> Bool {
            confirmations += 1; XCTAssertEqual(username, "test-user@example.test"); XCTAssertEqual(code, "123456")
            return try await confirmation()
        }
        func resendRegistration(username: String) async throws {
            resends += 1; XCTAssertEqual(username, "test-user@example.test"); try await resend()
        }
    }
    @MainActor private func create(_ model: AccountRegistration) {
        model.register(email: " test-user@example.test ", password: " test-password ", name: " Test person ")
    }
    @MainActor private func observe(_ model: AccountRegistration, until predicate: @escaping (RegistrationState) -> Bool,
                                    action: () -> Void) async {
        let changed = expectation(description: "Registration reaches expected state")
        let observation = model.$state.filter(predicate).prefix(1).sink { _ in changed.fulfill() }
        action(); await fulfillment(of: [changed], timeout: 5); observation.cancel()
    }
    @MainActor func testConsentAndRequiredDetailsBlockRegistration() {
        let service = Fake(); let model = AccountRegistration(service: service); model.open(); create(model)
        XCTAssertEqual(service.registrations, 0); model.accept(true)
        model.register(email: " ", password: " test-password ", name: "Test person")
        model.register(email: "test-user@example.test", password: "", name: "Test person")
        model.register(email: "test-user@example.test", password: " test-password ", name: " ")
        XCTAssertEqual(service.registrations, 0); model.close(); model.open(); XCTAssertFalse(model.state.accepted)
    }
    @MainActor func testRegisterResendConfirmUsesOriginalUsername() async {
        let service = Fake(); let model = AccountRegistration(service: service); model.open(); model.accept(true)
        await observe(model, until: { $0.step == .confirm && !$0.busy }) { create(model) }
        await observe(model, until: { $0.codeRequested && !$0.busy }) { model.resend() }
        create(model)
        await observe(model, until: { $0.step == .complete }) { model.confirm(" 123456 ") }
        model.confirm("123456"); model.resend()
        XCTAssertEqual(service.registrations, 1); XCTAssertEqual(service.confirmations, 1); XCTAssertEqual(service.resends, 1)
        model.close()
    }
    @MainActor func testCompletedSignupSkipsConfirmation() async {
        let service = Fake(); service.registration = { true }
        let model = AccountRegistration(service: service); model.open(); model.accept(true)
        await observe(model, until: { $0.step == .complete }) { create(model) }
        XCTAssertEqual(service.confirmations, 0); model.close()
    }
    @MainActor func testMissingConfigurationAndWrongStepNeverCallProvider() {
        let blocked = AccountRegistration(service: nil); blocked.open(); blocked.accept(true); create(blocked)
        blocked.resumeConfirmation("test-user@example.test"); XCTAssertEqual(blocked.state, RegistrationState())
        let service = Fake(); let model = AccountRegistration(service: service); model.open(); model.confirm("123456"); model.resend()
        XCTAssertEqual(service.confirmations + service.resends, 0); model.close()
    }
    @MainActor func testIncompleteConfirmationAndResendFailureCanRetry() async {
        let service = Fake(); service.confirmation = { false }
        let model = AccountRegistration(service: service); model.resumeConfirmation(" test-user@example.test ")
        await observe(model, until: { $0.failed && !$0.busy }) { model.confirm("123456") }
        XCTAssertEqual(model.state.step, .confirm)
        service.resend = { throw MobileFailure.session }
        await observe(model, until: { $0.failed && !$0.busy }) { model.resend() }
        service.resend = {}
        await observe(model, until: { $0.codeRequested && !$0.busy }) { model.resend() }
        service.confirmation = { true }
        await observe(model, until: { $0.step == .complete }) { model.confirm("123456") }
        model.close()
    }
    @MainActor func testRegistrationFailureAllowsExplicitRetry() async {
        let service = Fake(); service.registration = { throw MobileFailure.session }
        let model = AccountRegistration(service: service); model.open(); model.accept(true)
        await observe(model, until: { $0.failed && !$0.busy }) { create(model) }
        service.registration = { false }
        await observe(model, until: { $0.step == .confirm }) { create(model) }
        XCTAssertEqual(service.registrations, 2); model.close()
    }
    @MainActor func testDuplicateAndLateRegistrationCannotReopenCancelledForm() async {
        let service = Fake(); let started = expectation(description: "Registration started")
        let returned = expectation(description: "Cancelled registration returned")
        var pending: CheckedContinuation<Bool, Never>?
        service.registration = {
            let value = await withCheckedContinuation { pending = $0; started.fulfill() }
            returned.fulfill(); return value
        }
        let model = AccountRegistration(service: service); model.open(); model.accept(true); create(model); create(model)
        await fulfillment(of: [started], timeout: 5); XCTAssertEqual(service.registrations, 1)
        model.close(); model.open(); pending?.resume(returning: false)
        await fulfillment(of: [returned], timeout: 5); await Task.yield()
        XCTAssertEqual(model.state, RegistrationState(step: .details)); model.close()
    }
    @MainActor func testCancellationClearsConfirmationSubject() {
        let service = Fake(); let model = AccountRegistration(service: service); model.resumeConfirmation("test-user@example.test")
        model.close(); model.confirm("123456"); model.resend()
        XCTAssertEqual(service.confirmations + service.resends, 0)
    }
}
