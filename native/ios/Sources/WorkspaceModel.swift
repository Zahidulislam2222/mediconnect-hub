import Amplify
import Foundation
import SwiftUI

@MainActor
final class WorkspaceModel: ObservableObject {
    @Published private(set) var identity: Identity?
    @Published private(set) var appointments: [Appointment] = []
    @Published private(set) var next: String?
    @Published private(set) var busy = false
    @Published private(set) var message: String?
    @Published private(set) var challenge = false
    @Published private(set) var visible = true
    let residency: String
    let content: MobileContent?
    private let auth: CognitoSession?
    private let api: AppointmentsAPI?
    private var operation: Task<Void, Never>?
    private var expiry: Task<Void, Never>?
    private var generation = 0
    var configured: Bool { auth != nil && api != nil }

    // A non-sensitive logout latch. Credentials remain managed by Amplify/Keychain.
    private var requiresExplicitSignIn: Bool {
        get { UserDefaults.standard.bool(forKey: "requires-explicit-sign-in") }
        set { UserDefaults.standard.set(newValue, forKey: "requires-explicit-sign-in") }
    }

    init() {
        residency = Bundle.main.object(forInfoDictionaryKey: "MediConnectResidency") as? String ?? ""
        content = try? MobileContent(data: BundledAssets.data("mobile-content"))
        do {
            let config = try MobileConfiguration(data: BundledAssets.data("mobile-config"), residency: residency)
            let contract = try MobileContract(data: BundledAssets.data("mobile-contract"), policy: BundledAssets.data("session-policy"))
            auth = try CognitoSession(config: config, contract: contract)
            api = AppointmentsAPI(config: config, contract: contract)
        } catch { auth = nil; api = nil }
    }

    private func clear(visible: Bool = true) {
        generation += 1
        operation?.cancel()
        expiry?.cancel()
        identity = nil
        appointments = []
        next = nil
        busy = false
        challenge = false
        message = nil
        self.visible = visible
    }
    func hide() { clear(visible: false) }
    func resume() {
        visible = true
        guard !busy, identity == nil, !requiresExplicitSignIn, let auth else { return }
        run(message: "sessionExpired") { [weak self] in
            let access = try await auth.fetch()
            try Task.checkCancellation()
            try await self?.accept(access)
        }
    }
    func signIn(email: String, password: String) {
        guard !busy, !email.isEmpty, !password.isEmpty, let auth else { return }
        requiresExplicitSignIn = true
        run(message: "signInFailed") { [weak self] in
            await auth.signOut()
            try Task.checkCancellation()
            let result = try await auth.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            try Task.checkCancellation()
            try await self?.complete(result)
        }
    }
    func confirm(code: String) {
        guard !busy, challenge, !code.isEmpty, let auth else { return }
        run(message: "signInFailed") { [weak self] in
            let result = try await auth.confirm(code: code)
            try Task.checkCancellation()
            try await self?.complete(result)
        }
    }
    private func complete(_ result: AuthSignInResult) async throws {
        guard let auth else { throw MobileFailure.configuration }
        if result.isSignedIn {
            let access = try await auth.fetch()
            try Task.checkCancellation()
            requiresExplicitSignIn = false
            try await accept(access)
        } else {
            switch result.nextStep {
            case .confirmSignInWithSMSMFACode, .confirmSignInWithTOTPCode, .confirmSignInWithOTP:
                challenge = true
            default:
                challenge = false
                message = "additionalStep"
            }
        }
    }
    private func accept(_ access: SessionAccess) async throws {
        identity = access.identity
        challenge = false
        expiry?.cancel()
        let expiresAt = access.identity.expiresAt
        expiry = Task { [weak self] in
            do { try await Task.sleep(until: .now + .seconds(max(0, expiresAt.timeIntervalSinceNow)), clock: .continuous) }
            catch { return }
            self?.clear()
            self?.message = "sessionExpired"
        }
        guard [.patient, .doctor].contains(access.identity.role), let api else { return }
        let page = try await api.load(access: access, cursor: nil)
        try Task.checkCancellation()
        appointments = page.items
        next = page.next
    }
    func refresh(more: Bool = false) {
        guard !busy, let identity, let auth, let api, !more || next != nil else { return }
        let cursor = more ? next : nil
        let previous = more ? appointments : []
        run(message: "unavailable") { [weak self] in
            let access = try await auth.fetch()
            try Task.checkCancellation()
            guard access.identity.subject == identity.subject, access.identity.role == identity.role else { throw MobileFailure.session }
            let page = try await api.load(access: access, cursor: cursor)
            try Task.checkCancellation()
            var ids = Set<String>()
            self?.appointments = (previous + page.items).filter { ids.insert($0.id).inserted }
            self?.next = page.next
        }
    }
    func signOut() {
        requiresExplicitSignIn = true
        clear()
        guard let auth else { return }
        run(message: "signInFailed") { await auth.signOut() }
    }
    private func run(message: String, block: @escaping @MainActor () async throws -> Void) {
        operation?.cancel()
        generation += 1
        let current = generation
        busy = true
        self.message = nil
        operation = Task { [weak self] in
            do { try await block() }
            catch is CancellationError { return }
            catch {
                guard let self, current == generation, !Task.isCancelled else { return }
                if (error as? HTTPFailure)?.status == 401 {
                    identity = nil
                    appointments = []
                    next = nil
                    self.message = "sessionExpired"
                } else if (error as? HTTPFailure)?.status == 403 { self.message = "accessDenied" }
                else { self.message = identity == nil ? message : "unavailable" }
            }
            if let self, current == generation { busy = false }
        }
    }
}
