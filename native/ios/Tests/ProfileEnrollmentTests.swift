import Combine
import XCTest
@testable import MediConnectApp

final class ProfileEnrollmentTests: XCTestCase {
    private let identity = Identity(subject: "test-patient", role: .patient, expiresAt: Date().addingTimeInterval(300))
    private var own: OwnProfile { OwnProfile(subject: identity.subject, name: "Test person", email: "test-user@example.test") }
    @MainActor private final class Fake: ProfileService {
        var reads = 0; var creates = 0
        var read: () async throws -> OwnProfile = { throw HTTPFailure(status: 404) }
        var create: () async throws -> Void = {}
        func load(identity: Identity) async throws -> OwnProfile { reads += 1; return try await read() }
        func create(identity: Identity, details: ProfileDetails, policyVersion: String) async throws {
            creates += 1; XCTAssertEqual(details.name, "Test person"); XCTAssertEqual(details.email, "test-user@example.test")
            XCTAssertEqual(policyVersion, "test-policy"); try await create()
        }
    }
    @MainActor private func submit(_ model: ProfileEnrollment) {
        model.submit(name: " Test person ", email: " test-user@example.test ", specialization: " Test specialty ")
    }
    @MainActor private func observe(_ model: ProfileEnrollment, step: ProfileStep, action: () -> Void) async {
        let changed = expectation(description: "Profile reaches expected state")
        let observation = model.$state.filter { $0.step == step && !$0.busy }.prefix(1).sink { _ in changed.fulfill() }
        action(); await fulfillment(of: [changed], timeout: 5); observation.cancel()
    }
    @MainActor func testOnly404AllowsExplicitConsentSetup() async {
        for status: Int? in [nil, 401, 403, 410, 429, 500, 503] {
            let service = Fake(); service.read = { throw HTTPFailure(status: status) }
            let model = ProfileEnrollment(service: service, policyVersion: "test-policy")
            await observe(model, step: .failed) { model.open(identity) }
            model.accept(true); submit(model); XCTAssertEqual(service.creates, 0); model.close()
        }
        let service = Fake(); let model = ProfileEnrollment(service: service, policyVersion: "test-policy")
        await observe(model, step: .missing) { model.open(identity) }
        submit(model); XCTAssertEqual(service.creates, 0); XCTAssertFalse(model.state.accepted); model.close()
    }
    @MainActor func testSetupRechecksCreatesOnceAndReadsBack() async {
        let service = Fake(); let own = own; service.create = { service.read = { own } }
        let model = ProfileEnrollment(service: service, policyVersion: "test-policy")
        await observe(model, step: .missing) { model.open(identity) }; model.accept(true)
        await observe(model, step: .ready) { submit(model); submit(model) }
        XCTAssertEqual(service.creates, 1); XCTAssertEqual(service.reads, 3); XCTAssertEqual(model.state.profile, own); model.close()
    }
    @MainActor func testExistingDuringRecheckSkipsCreate() async {
        let service = Fake(); let model = ProfileEnrollment(service: service, policyVersion: "test-policy")
        await observe(model, step: .missing) { model.open(identity) }; model.accept(true)
        let own = own; service.read = { own }
        await observe(model, step: .ready) { submit(model) }; XCTAssertEqual(service.creates, 0); model.close()
    }
    @MainActor func testConflictRequiresOwnReadback() async {
        for valid in [true, false] {
            let service = Fake(); let own = own
            service.create = {
                service.read = { valid ? own : OwnProfile(subject: "other-patient", name: own.name, email: own.email) }
                throw HTTPFailure(status: 409)
            }
            let model = ProfileEnrollment(service: service, policyVersion: "test-policy")
            await observe(model, step: .missing) { model.open(identity) }; model.accept(true)
            await observe(model, step: valid ? .ready : .failed) { submit(model) }; model.close()
        }
    }
    @MainActor func testUnknownOutcomeRequiresCheckAndFreshConsent() async {
        let service = Fake(); service.create = { throw HTTPFailure(status: nil) }
        let model = ProfileEnrollment(service: service, policyVersion: "test-policy")
        await observe(model, step: .missing) { model.open(identity) }; model.accept(true)
        await observe(model, step: .failed) { submit(model) }; submit(model); XCTAssertEqual(service.creates, 1)
        await observe(model, step: .missing) { model.check() }; XCTAssertFalse(model.state.accepted); model.close()
    }
    @MainActor func testForeignProfileAndUnsupportedRoleCannotCreate() async {
        let service = Fake(); service.read = { OwnProfile(subject: "other-patient", name: "Test person", email: "test-user@example.test") }
        let model = ProfileEnrollment(service: service, policyVersion: "test-policy")
        await observe(model, step: .failed) { model.open(identity) }
        model.open(Identity(subject: identity.subject, role: .admin, expiresAt: identity.expiresAt))
        XCTAssertEqual(model.state.step, .closed); XCTAssertEqual(service.reads, 1); model.close()
    }
    @MainActor func testCancelledReadCannotRestoreProfile() async {
        let service = Fake(); let started = expectation(description: "Read started")
        let returned = expectation(description: "Read returned"); var pending: CheckedContinuation<OwnProfile, Never>?
        service.read = {
            let value = await withCheckedContinuation { pending = $0; started.fulfill() }
            returned.fulfill(); return value
        }
        let model = ProfileEnrollment(service: service, policyVersion: "test-policy"); model.open(identity)
        await fulfillment(of: [started], timeout: 5); model.close(); pending?.resume(returning: own)
        await fulfillment(of: [returned], timeout: 5); await Task.yield(); XCTAssertEqual(model.state, ProfileState())
    }
    @MainActor func testDoctorNeedsSpecializationAndConfiguration() async {
        let absent = ProfileEnrollment(service: nil, policyVersion: "test-policy"); absent.open(identity)
        XCTAssertEqual(absent.state.step, .closed)
        let service = Fake(); let model = ProfileEnrollment(service: service, policyVersion: "test-policy")
        await observe(model, step: .missing) { model.open(Identity(subject: identity.subject, role: .doctor, expiresAt: identity.expiresAt)) }
        model.accept(true); model.submit(name: "Test person", email: "test-user@example.test", specialization: " ")
        XCTAssertEqual(service.creates, 0); model.close()
    }
}
