import Combine
import XCTest
@testable import MediConnectApp

final class PatientSettingsEditorTests: XCTestCase {
    private var identity: Identity { Identity(subject: "test-patient", role: .patient, expiresAt: Date().addingTimeInterval(300)) }
    private var own: PatientSettingsSnapshot {
        PatientSettingsSnapshot(subject: "test-patient", name: "Test person", email: "test@example.test", phone: nil, address: nil, preferences: nil)
    }
    @MainActor private final class Fake: PatientSettingsService {
        var writes = 0
        var read: () async throws -> PatientSettingsSnapshot
        var write: (PatientSettingsDraft) async throws -> Void = { _ in }
        init(snapshot: PatientSettingsSnapshot) { read = { snapshot } }
        func load(identity: Identity) async throws -> PatientSettingsSnapshot { try await read() }
        func save(identity: Identity, snapshot: PatientSettingsSnapshot, draft: PatientSettingsDraft) async throws {
            writes += 1; try await write(draft)
        }
    }
    @MainActor private func observe(_ model: PatientSettingsEditor, step: SettingsStep, action: () -> Void) async {
        let changed = expectation(description: "Settings reaches expected state")
        let observation = model.$state.filter { $0.step == step }.prefix(1).sink { _ in changed.fulfill() }
        action(); await fulfillment(of: [changed], timeout: 5); observation.cancel()
    }
    @MainActor func testSaveRequiresReadbackAndBlocksDuplicateSubmissions() async {
        let service = Fake(snapshot: own); let model = PatientSettingsEditor(service: service, maxNameLength: 200)
        await observe(model, step: .editing) { model.open(identity) }
        var draft = PatientSettingsDraft(snapshot: own); draft.name = "Changed"
        service.write = { value in service.read = {
            PatientSettingsSnapshot(subject: "test-patient", name: value.name, email: "test@example.test", phone: nil, address: nil, preferences: nil)
        } }
        model.edit(draft)
        await observe(model, step: .saved) { model.save(); model.save() }
        XCTAssertEqual(service.writes, 1); XCTAssertEqual(model.state.snapshot?.name, "Changed"); model.close()
    }
    @MainActor func testUncertainSaveCannotRetryUntilReload() async {
        let service = Fake(snapshot: own); let model = PatientSettingsEditor(service: service, maxNameLength: 200)
        await observe(model, step: .editing) { model.open(identity) }
        var draft = PatientSettingsDraft(snapshot: own); draft.name = "Changed"; model.edit(draft)
        await observe(model, step: .saveUncertain) { model.save() }
        model.save(); model.discard(); XCTAssertEqual(service.writes, 1)
        await observe(model, step: .editing) { model.reload() }
        XCTAssertEqual(model.state.draft?.name, own.name); model.close()
    }
    @MainActor func testInvalidDraftAndDiscardNeverWrite() async {
        let service = Fake(snapshot: own); let model = PatientSettingsEditor(service: service, maxNameLength: 200)
        await observe(model, step: .editing) { model.open(identity) }
        var draft = PatientSettingsDraft(snapshot: own); draft.name = " "; model.edit(draft); model.save()
        XCTAssertTrue(model.state.invalid); XCTAssertEqual(service.writes, 0)
        model.discard(); XCTAssertEqual(model.state.draft, PatientSettingsDraft(snapshot: own)); model.close()
    }
    @MainActor func testClosingPreventsNonCooperativeReadFromRestoringState() async throws {
        let service = Fake(snapshot: own); let model = PatientSettingsEditor(service: service, maxNameLength: 200)
        let started = expectation(description: "Read started")
        var pending: CheckedContinuation<PatientSettingsSnapshot, Never>?
        service.read = { await withCheckedContinuation { pending = $0; started.fulfill() } }
        model.open(identity); await fulfillment(of: [started], timeout: 5)
        let operation = try XCTUnwrap(model.operation)
        let response = try XCTUnwrap(pending)
        model.close(); response.resume(returning: own)
        await operation.value
        XCTAssertEqual(model.state, SettingsState())
    }
    @MainActor func testDeniedAndUnsupportedRoleDoNotExposeAnEditor() async {
        let service = Fake(snapshot: own); service.read = { throw HTTPFailure(status: 403) }
        let model = PatientSettingsEditor(service: service, maxNameLength: 200)
        await observe(model, step: .denied) { model.open(identity) }
        XCTAssertNil(model.state.snapshot)
        model.open(Identity(subject: identity.subject, role: .doctor, expiresAt: identity.expiresAt))
        XCTAssertEqual(model.state, SettingsState()); model.close()
    }
}
