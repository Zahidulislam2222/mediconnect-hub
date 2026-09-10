import Amplify
import Combine
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
    @Published private(set) var challengeInput: ChallengeInput = .code
    @Published private(set) var challengeChoices: [MFAType] = []
    @Published private(set) var visible = true
    let residency: String
    let content: MobileContent?
    let policies: MobilePolicies?
    let registration: AccountRegistration
    let cancellation: AppointmentCancellation
    let recovery: PasswordRecovery
    let profile: ProfileEnrollment
    private var profileObservation: AnyCancellable?
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
        policies = try? MobilePolicies(legal: BundledAssets.data("legal"), consent: BundledAssets.data("consent"))
        var profileService: ProfileAPI?
        var cancellationService: AppointmentCancellationAPI?
        var cancellationPolicy: CancellationContract?
        do {
            let config = try MobileConfiguration(data: BundledAssets.data("mobile-config"), residency: residency)
            let contract = try MobileContract(data: BundledAssets.data("mobile-contract"), policy: BundledAssets.data("session-policy"))
            let session = try CognitoSession(config: config, contract: contract)
            auth = session
            profileService = ProfileAPI(transport: NativeAPI(config: config), contract: contract, fetch: { try await session.fetch() })
            let appointments = AppointmentsAPI(config: config, contract: contract)
            api = appointments
            cancellationService = AppointmentCancellationAPI(appointments: appointments, transport: NativeAPI(config: config), contract: contract, fetch: { try await session.fetch() })
            cancellationPolicy = contract.cancellation
        } catch { auth = nil; api = nil }
        cancellation = AppointmentCancellation(service: cancellationService, policy: cancellationPolicy)
        profile = ProfileEnrollment(service: profileService, policyVersion: policies?.policyVersion ?? "")
        recovery = PasswordRecovery(service: auth)
        registration = AccountRegistration(service: policies == nil ? nil : auth)
        profileObservation = profile.$state.filter { $0.step == .ready }.sink { [weak self] value in
            Task { @MainActor [weak self] in
                guard let self, value.profile?.subject == identity?.subject, profile.state.step == .ready else { return }
                refresh()
            }
        }
    }

    private func clear(visible: Bool = true) {
        cancellation.close(clearSession: true)
        profile.close()
        generation += 1
        operation?.cancel()
        expiry?.cancel()
        identity = nil
        appointments = []
        next = nil
        busy = false
        challenge = false
        challengeInput = .code
        challengeChoices = []
        message = nil
        self.visible = visible
    }
    func hide() { registration.close(); recovery.close(); clear(visible: false) }
    func openRegistration() {
        guard configured, policies != nil else { return }
        requiresExplicitSignIn = true
        recovery.close(); clear(); registration.open()
    }
    func openRecovery() {
        registration.close()
        guard configured else { return }
        requiresExplicitSignIn = true
        clear()
        recovery.open()
    }
    func resume() {
        guard recovery.state.step == .closed, registration.state.step == .closed else { return }
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
            if case .confirmSignUp = result.nextStep { self?.registration.resumeConfirmation(email) }
            else { try await self?.complete(result) }
        }
    }
    func confirm(code: String) {
        guard !busy, challenge, let auth else { return }
        let selected = challengeChoices.isEmpty ? SignInChallenge.response(challengeInput, value: code)
            : SignInChallenge.selectionResponse(challengeChoices, value: code)
        guard let response = selected else { return }
        run(message: "signInFailed") { [weak self] in
            let result = try await auth.confirm(code: response)
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
            let input = SignInChallenge.input(result.nextStep)
            challengeChoices = SignInChallenge.choices(result.nextStep)
            challenge = input != nil || !challengeChoices.isEmpty
            challengeInput = input ?? .code
            message = challenge ? nil : "additionalStep"
        }
    }
    private func accept(_ access: SessionAccess) async throws {
        identity = access.identity
        challenge = false
        challengeChoices = []
        expiry?.cancel()
        let expiresAt = access.identity.expiresAt
        expiry = Task { [weak self] in
            do { try await Task.sleep(until: .now + .seconds(max(0, expiresAt.timeIntervalSinceNow)), clock: .continuous) }
            catch { return }
            self?.clear()
            self?.message = "sessionExpired"
        }
        profile.open(access.identity)
    }
    func refresh(more: Bool = false) {
        guard !busy, profile.state.step == .ready, let identity, let auth, let api, !more || next != nil else { return }
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
    func openCancellation(_ appointment: Appointment) {
        guard !busy, profile.state.step == .ready, let identity, appointments.contains(where: { $0.id == appointment.id }) else { return }
        cancellation.open(identity, appointment: appointment)
    }
    func closeCancellation() {
        let confirmed = cancellation.state.step == .confirmed
        cancellation.close()
        if confirmed { refresh() }
    }
    func signOut() {
        registration.close()
        recovery.close()
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
