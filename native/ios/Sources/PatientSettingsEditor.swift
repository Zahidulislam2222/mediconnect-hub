import Combine
import Foundation

enum SettingsStep: Equatable { case closed, loading, editing, saving, saved, loadFailed, saveUncertain, denied, missing }
struct SettingsState: Equatable {
    var step: SettingsStep = .closed
    var snapshot: PatientSettingsSnapshot?
    var draft: PatientSettingsDraft?
    var invalid = false
    var busy: Bool { step == .loading || step == .saving }
    var editable: Bool { step == .editing || step == .saved }
}

@MainActor final class PatientSettingsEditor: ObservableObject {
    @Published private(set) var state = SettingsState()
    private let service: PatientSettingsService
    private let maxNameLength: Int
    private var identity: Identity?
    private(set) var operation: Task<Void, Never>?
    private var generation = 0
    init(service: PatientSettingsService, maxNameLength: Int) {
        self.service = service; self.maxNameLength = maxNameLength
    }
    func close() { generation += 1; operation?.cancel(); operation = nil; identity = nil; state = SettingsState() }
    func open(_ value: Identity) {
        close()
        guard value.role == .patient, value.expiresAt > Date() else { return }
        identity = value; reload()
    }
    func edit(_ draft: PatientSettingsDraft) {
        guard state.editable, state.draft != draft else { return }
        state.step = .editing; state.draft = draft; state.invalid = false
    }
    func discard() {
        guard state.editable, let snapshot = state.snapshot else { return }
        state.step = .editing; state.draft = PatientSettingsDraft(snapshot: snapshot); state.invalid = false
    }
    func reload() {
        guard let identity, !state.busy else { return }
        generation += 1; let current = generation
        state = SettingsState(step: .loading)
        operation = Task { [weak self] in
            guard let self else { return }
            do {
                let snapshot = try await service.load(identity: identity)
                try Task.checkCancellation()
                guard generation == current else { return }
                guard snapshot.subject == identity.subject else { throw MobileFailure.response }
                state = SettingsState(step: .editing, snapshot: snapshot, draft: PatientSettingsDraft(snapshot: snapshot))
            } catch is CancellationError { return }
            catch {
                guard generation == current, !Task.isCancelled else { return }
                let status = (error as? HTTPFailure)?.status
                state = SettingsState(step: status == 401 || status == 403 ? .denied : (status == 404 ? .missing : .loadFailed))
            }
        }
    }
    func save() {
        guard let identity, state.editable, let snapshot = state.snapshot, let draft = state.draft else { return }
        let changes: [String: Any]
        do { changes = try PatientSettingsData.changes(snapshot: snapshot, draft: draft, maxNameLength: maxNameLength) }
        catch { state.invalid = true; return }
        guard !changes.isEmpty else { return }
        let before = state
        generation += 1; let current = generation
        state.step = .saving; state.invalid = false
        operation = Task { [weak self] in
            guard let self else { return }
            do {
                try await service.save(identity: identity, snapshot: snapshot, draft: draft)
                try Task.checkCancellation()
                guard generation == current else { return }
                let saved = try await service.load(identity: identity)
                try Task.checkCancellation()
                guard generation == current else { return }
                guard saved.subject == identity.subject,
                      draft.name == snapshot.name || saved.name == draft.name,
                      draft.phone == snapshot.phone || saved.phone == draft.phone,
                      draft.address == snapshot.address || saved.address == draft.address,
                      draft.preferences == snapshot.preferences || saved.preferences == draft.preferences else { throw MobileFailure.response }
                state = SettingsState(step: .saved, snapshot: saved, draft: PatientSettingsDraft(snapshot: saved))
            } catch is CancellationError { return }
            catch {
                guard generation == current, !Task.isCancelled else { return }
                let status = (error as? HTTPFailure)?.status
                if status == 401 || status == 403 { state = SettingsState(step: .denied) }
                else { state = before; state.step = .saveUncertain }
            }
        }
    }
}
