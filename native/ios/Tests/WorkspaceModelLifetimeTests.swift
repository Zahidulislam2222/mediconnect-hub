import Amplify
import Combine
import XCTest
@testable import MediConnectApp

final class WorkspaceModelLifetimeTests: XCTestCase {
    @MainActor private final class Pending<Value> {
        let started = XCTestExpectation(description: "Fake provider operation started")
        private var continuation: CheckedContinuation<Value, Error>?
        func wait() async throws -> Value {
            try await withCheckedThrowingContinuation { continuation in
                self.continuation = continuation
                started.fulfill()
            }
        }
        func complete(_ value: Value) {
            XCTAssertNotNil(continuation)
            let current = continuation; continuation = nil; current?.resume(returning: value)
        }
        func fail(_ error: Error) {
            XCTAssertNotNil(continuation)
            let current = continuation; continuation = nil; current?.resume(throwing: error)
        }
        func close() {
            let current = continuation; continuation = nil; current?.resume(throwing: CancellationError())
        }
    }
    @MainActor private final class Fake: WorkspaceSession, WorkspaceAppointments, ProfileService, ExplicitSignInLatch {
        var required = true
        var confirmations = 0
        var fetches = 0
        var profileLoads = 0
        let profileStarted = XCTestExpectation(description: "Current identity starts profile loading")
        let identity = Identity(subject: "test-patient", role: .patient, expiresAt: Date().addingTimeInterval(3600))
        var signInResult = AuthSignInResult(nextStep: .continueSignInWithTOTPSetup(TOTPSetupDetails(sharedSecret: "test-key", username: "test-user")))
        var confirmation: () async throws -> AuthSignInResult = { AuthSignInResult(nextStep: .done) }
        var session: (() async throws -> SessionAccess)?
        var profileResponse: (() async throws -> OwnProfile)?
        func signIn(email: String, password: String) async throws -> AuthSignInResult { signInResult }
        func confirm(code: String) async throws -> AuthSignInResult { confirmations += 1; return try await confirmation() }
        func fetch() async throws -> SessionAccess {
            fetches += 1
            if let session { return try await session() }
            return SessionAccess(identity: identity, token: "test-token")
        }
        func signOut() async {}
        func load(identity: Identity) async throws -> OwnProfile {
            profileLoads += 1; profileStarted.fulfill()
            if let profileResponse { return try await profileResponse() }
            return OwnProfile(subject: identity.subject, name: "Test Patient", email: "test@example.invalid")
        }
        func load(access: SessionAccess, cursor: String?) async throws -> AppointmentPage { AppointmentPage(items: [], next: nil) }
        func create(identity: Identity, details: ProfileDetails, policyVersion: String) async throws { throw MobileFailure.configuration }
        func requestReset(username: String) async throws -> Bool { throw MobileFailure.configuration }
        func confirmReset(username: String, password: String, code: String) async throws { throw MobileFailure.configuration }
        func register(username: String, password: String, name: String) async throws -> Bool { throw MobileFailure.configuration }
        func confirmRegistration(username: String, code: String) async throws -> Bool { throw MobileFailure.configuration }
        func resendRegistration(username: String) async throws { throw MobileFailure.configuration }
    }
    @MainActor private func makeModel(_ fake: Fake) async -> WorkspaceModel {
        let model = WorkspaceModel(residency: "US", content: nil, policies: nil, auth: fake, api: fake,
                                   profileService: fake, cancellationService: nil, cancellationPolicy: nil, signInLatch: fake)
        model.signIn(email: "test@example.invalid", password: "test-password")
        await model.operation?.value
        XCTAssertTrue(model.configured); XCTAssertTrue(model.challenge); XCTAssertFalse(model.busy)
        return model
    }
    @MainActor private func assertCleared(_ model: WorkspaceModel, fake: Fake, visible: Bool) {
        XCTAssertNil(model.identity); XCTAssertFalse(model.challenge); XCTAssertNil(model.authenticatorSetup)
        XCTAssertEqual(model.visible, visible); XCTAssertFalse(model.busy)
        XCTAssertEqual(fake.profileLoads, 0); XCTAssertTrue(fake.required)
    }

    @MainActor func testIdleAuthenticatorSurvivesBackgroundWithoutAuthenticating() async {
        let fake = Fake(); let model = await makeModel(fake); defer { model.hide() }
        model.hide(); XCTAssertFalse(model.visible); model.resume()
        XCTAssertTrue(model.visible); XCTAssertTrue(model.challenge); XCTAssertNotNil(model.authenticatorSetup)
        XCTAssertNil(model.identity); XCTAssertEqual(fake.confirmations, 0); XCTAssertEqual(fake.fetches, 0)
        XCTAssertEqual(fake.profileLoads, 0); XCTAssertTrue(fake.required)
        model.signOut(); await model.operation?.value
    }
    @MainActor func testLateSignedInConfirmationAfterBackgroundCannotRestoreSession() async {
        let held = Pending<AuthSignInResult>(); let fake = Fake(); fake.confirmation = { try await held.wait() }
        let model = await makeModel(fake); defer { held.close(); model.hide() }
        model.confirm(code: "123456"); let operation = model.operation
        await fulfillment(of: [held.started], timeout: 5)
        model.hide(); held.complete(AuthSignInResult(nextStep: .done)); await operation?.value
        assertCleared(model, fake: fake, visible: false); XCTAssertEqual(fake.fetches, 0)
    }
    @MainActor func testLateChallengeAfterBackgroundCannotRestoreSetup() async {
        let held = Pending<AuthSignInResult>(); let fake = Fake(); fake.confirmation = { try await held.wait() }
        let model = await makeModel(fake); defer { held.close(); model.hide() }
        model.confirm(code: "123456"); let operation = model.operation
        await fulfillment(of: [held.started], timeout: 5)
        model.hide(); held.complete(fake.signInResult); await operation?.value
        assertCleared(model, fake: fake, visible: false); XCTAssertEqual(fake.fetches, 0)
    }
    @MainActor func testLateConfirmationAfterSignOutCannotClearLatch() async {
        let held = Pending<AuthSignInResult>(); let fake = Fake(); fake.confirmation = { try await held.wait() }
        let model = await makeModel(fake); defer { held.close(); model.hide() }
        model.confirm(code: "123456"); let old = model.operation
        await fulfillment(of: [held.started], timeout: 5)
        model.signOut(); await model.operation?.value
        held.complete(AuthSignInResult(nextStep: .done)); await old?.value
        assertCleared(model, fake: fake, visible: true); XCTAssertEqual(fake.fetches, 0)
    }
    @MainActor func testLateSessionFetchAfterBackgroundCannotLoadProfile() async {
        let held = Pending<SessionAccess>(); let fake = Fake(); fake.session = { try await held.wait() }
        let model = await makeModel(fake); defer { held.close(); model.hide() }
        model.confirm(code: "123456"); let old = model.operation
        await fulfillment(of: [held.started], timeout: 5)
        XCTAssertEqual(fake.fetches, 1); model.hide()
        held.complete(SessionAccess(identity: fake.identity, token: "test-token")); await old?.value
        assertCleared(model, fake: fake, visible: false)
    }
    @MainActor func testCancelledOldSuccessCannotOverwriteNewChallenge() async {
        let held = Pending<AuthSignInResult>(); let fake = Fake(); fake.confirmation = { try await held.wait() }
        let model = await makeModel(fake); defer { held.close(); model.hide() }
        model.confirm(code: "123456"); let old = model.operation
        await fulfillment(of: [held.started], timeout: 5)
        model.signOut(); await model.operation?.value
        fake.signInResult = AuthSignInResult(nextStep: .confirmSignInWithTOTPCode)
        model.signIn(email: "test@example.invalid", password: "test-password"); await model.operation?.value
        held.complete(AuthSignInResult(nextStep: .continueSignInWithTOTPSetup(TOTPSetupDetails(sharedSecret: "test-key", username: "test-user"))))
        await old?.value
        XCTAssertTrue(model.challenge); XCTAssertEqual(model.challengeInput, .code); XCTAssertNil(model.authenticatorSetup)
        XCTAssertFalse(model.busy); XCTAssertNil(model.identity); XCTAssertEqual(fake.fetches, 0); XCTAssertTrue(fake.required)
    }
    @MainActor func testCancelledOldErrorCannotOverwriteNewBusyAttempt() async {
        let held = Pending<AuthSignInResult>(); let newer = Pending<AuthSignInResult>()
        let fake = Fake(); fake.confirmation = { try await held.wait() }
        let model = await makeModel(fake); defer { held.close(); newer.close(); model.hide() }
        model.confirm(code: "123456"); let old = model.operation
        await fulfillment(of: [held.started], timeout: 5)
        model.signOut(); await model.operation?.value
        model.signIn(email: "test@example.invalid", password: "test-password"); await model.operation?.value
        fake.confirmation = { try await newer.wait() }; model.confirm(code: "654321"); let current = model.operation
        await fulfillment(of: [newer.started], timeout: 5)
        held.fail(MobileFailure.session); await old?.value
        XCTAssertTrue(model.busy); XCTAssertTrue(model.challenge); XCTAssertNil(model.message)
        newer.complete(AuthSignInResult(nextStep: .done)); await current?.value
        await fulfillment(of: [fake.profileStarted], timeout: 5)
        XCTAssertEqual(model.identity, fake.identity)
    }
    @MainActor func testDuplicateConfirmationAndPositiveFreshSessionControl() async {
        let held = Pending<AuthSignInResult>(); let fake = Fake(); fake.confirmation = { try await held.wait() }
        let profile = Pending<OwnProfile>(); fake.profileResponse = { try await profile.wait() }
        let model = await makeModel(fake); defer { model.hide(); held.close(); profile.close() }
        model.confirm(code: "123456"); let operation = model.operation
        await fulfillment(of: [held.started], timeout: 5)
        model.confirm(code: "654321"); XCTAssertEqual(fake.confirmations, 1); XCTAssertEqual(fake.fetches, 0)
        held.complete(AuthSignInResult(nextStep: .done)); await operation?.value
        // Hold profile readiness so its legitimate appointment refresh cannot add another fetch yet.
        await fulfillment(of: [profile.started], timeout: 5)
        XCTAssertEqual(model.identity, fake.identity); XCTAssertEqual(fake.fetches, 1)
        XCTAssertEqual(fake.profileLoads, 1); XCTAssertFalse(fake.required)
        let ready = expectation(description: "Accepted identity completes own-profile loading")
        let observation = model.profile.$state.filter { $0.step == .ready && !$0.busy }.prefix(1).sink { _ in ready.fulfill() }
        profile.complete(OwnProfile(subject: fake.identity.subject, name: "Test Patient", email: "test@example.invalid"))
        await fulfillment(of: [ready], timeout: 5)
        observation.cancel()
    }
    @MainActor func testRejectedConfirmationCanRetryWithoutFalseAuthentication() async {
        let fake = Fake(); fake.confirmation = { throw MobileFailure.session }; let model = await makeModel(fake)
        defer { model.hide() }
        model.confirm(code: "123456"); await model.operation?.value
        XCTAssertTrue(model.challenge); XCTAssertFalse(model.busy); XCTAssertNil(model.identity)
        XCTAssertEqual(fake.fetches, 0); XCTAssertTrue(fake.required)
        fake.confirmation = { AuthSignInResult(nextStep: .done) }
        model.confirm(code: "654321"); await model.operation?.value
        await fulfillment(of: [fake.profileStarted], timeout: 5)
        XCTAssertEqual(model.identity, fake.identity); XCTAssertEqual(fake.confirmations, 2)
    }
}
