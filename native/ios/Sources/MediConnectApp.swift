import SwiftUI

@main
@MainActor
struct MediConnectApp: App {
    @StateObject private var model = WorkspaceModel()
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup {
            if let content = model.content {
                root(content)
                    .onChange(of: phase) { value in if value == .active { model.resume() } else { model.hide() } }
                    .task { if phase == .active { model.resume() } }
            }
        }
    }
    @ViewBuilder private func root(_ content: MobileContent) -> some View {
        #if DEBUG
        if CancellationUITestFixture.requested() { CancellationUITestFixture(content: content) }
        else if ChallengeUITestFixture.requested() { ChallengeUITestFixture(content: content) }
        else if ProfileUITestFixture.requested(), let policies = model.policies {
            ProfileUITestFixture(content: content, policies: policies)
        } else if RegistrationUITestFixture.requested(), let policies = model.policies {
            RegistrationUITestFixture(content: content, policies: policies)
        } else if RecoveryUITestFixture.requested() { RecoveryUITestFixture(content: content) }
        else { WorkspaceView(model: model, content: content, recovery: model.recovery, registration: model.registration, profile: model.profile, cancellation: model.cancellation) }
        #else
        WorkspaceView(model: model, content: content, recovery: model.recovery, registration: model.registration, profile: model.profile, cancellation: model.cancellation)
        #endif
    }
}

private extension MobileContent {
    func color(_ key: String) -> Color {
        let value = label("theme", key).trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard let rgb = UInt32(value, radix: 16) else { return .primary }
        return Color(.sRGB, red: Double((rgb >> 16) & 255) / 255,
                     green: Double((rgb >> 8) & 255) / 255, blue: Double(rgb & 255) / 255, opacity: 1)
    }
}

struct WorkspaceView: View {
    @ObservedObject var model: WorkspaceModel
    let content: MobileContent
    @ObservedObject var recovery: PasswordRecovery
    @ObservedObject var registration: AccountRegistration
    @ObservedObject var profile: ProfileEnrollment
    @ObservedObject var cancellation: AppointmentCancellation
    @State private var email = ""
    @State private var password = ""
    @State private var code = ""
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(content.text("brand")).font(.largeTitle.bold())
                        Text(content.text("tagline")).foregroundStyle(content.color("muted"))
                        Text(content.label("residency", model.residency)).font(.subheadline)
                    }
                    if model.visible {
                        if let policies = model.policies { PolicyLinks(policies: policies, content: content) }
                        if !model.configured { Text(content.text("configurationUnavailable")) }
                        else {
                            if registration.state.step != .closed, let policies = model.policies {
                                RegistrationView(model: registration, content: content, policies: policies).id(registration.state.step)
                            } else if recovery.state.step != .closed {
                                RecoveryView(model: recovery, content: content).id(recovery.state.step)
                            } else {
                                if let message = model.message { Text(content.text(message)).foregroundStyle(content.color("error")) }
                                if let identity = model.identity { workspace(identity) }
                                else { signInForm }
                                if model.busy { ProgressView(content.text("loading")) }
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading).padding(24)
            }
            .background(content.color("background"))
            .foregroundStyle(content.color("foreground"))
            .tint(content.color("accent"))
            .sheet(isPresented: Binding(get: { cancellation.state.step != .closed }, set: { if !$0 { model.closeCancellation() } })) {
                CancellationView(model: cancellation, content: content, close: model.closeCancellation)
            }
            .onChange(of: model.challengeInput) { _ in code = "" }
            .onChange(of: model.visible) { visible in if !visible { email = ""; password = ""; code = "" } }
        }
    }
    private var signInForm: some View {
        VStack(alignment: .leading, spacing: 16) {
            if model.challenge {
                ChallengeResponseView(input: model.challengeInput, content: content, busy: model.busy,
                                      confirm: { model.confirm(code: $0) }, cancel: model.signOut).id(model.challengeInput)
            } else {
                TextField(content.text("email"), text: $email).textContentType(.username)
                    .keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                SecureField(content.text("password"), text: $password).textContentType(.password)
                Button(content.text("signIn")) { let value = password; password = ""; model.signIn(email: email, password: value) }
                    .disabled(email.isEmpty || password.isEmpty || model.busy)
                Button(content.text("createAccount")) {
                    email = ""; password = ""; code = ""; model.openRegistration()
                }.disabled(model.policies == nil)
                Button(content.text("forgotPassword")) {
                    email = ""; password = ""; code = ""; model.openRecovery()
                }
            }
        }
        .textFieldStyle(.roundedBorder).buttonStyle(.borderedProminent).disabled(model.busy)
    }
    @ViewBuilder private func workspace(_ identity: Identity) -> some View {
        HStack {
            Text(content.label("roles", identity.role.rawValue)).font(.title2)
            Spacer()
            Button(content.text("signOut"), action: model.signOut)
        }
        if identity.role == .patient || identity.role == .doctor {
            if profile.state.step != .ready, let policies = model.policies {
                ProfileSetupView(model: profile, role: identity.role, content: content, policies: policies).id(profile.state.step)
            } else {
            HStack {
                Text(content.text("appointments")).font(.title2.bold())
                Spacer()
                Button(content.text("refresh")) { model.refresh() }.disabled(model.busy)
            }
            if !model.busy && model.message == nil && model.appointments.isEmpty { Text(content.text("emptyAppointments")) }
            ForEach(model.appointments) { appointment in
                VStack(alignment: .leading, spacing: 8) {
                    if identity.role == .patient {
                        Button(content.text("cancelAppointment")) { model.openCancellation(appointment) }.disabled(model.busy)
                    }
                    Text(appointment.person ?? content.text("unknown")).font(.headline)
                    if let time = appointment.time { Text(time, format: .dateTime) }
                    else { Text(content.text("unknown")) }
                    Text(appointment.status ?? content.text("unknown")).foregroundStyle(content.color("muted"))
                }
                .frame(maxWidth: .infinity, alignment: .leading).padding(20)
                .background(content.color("surface"), in: RoundedRectangle(cornerRadius: 10))
            }
            if model.next != nil { Button(content.text("loadMore")) { model.refresh(more: true) }.disabled(model.busy) }
            }
        } else { Text(content.text("roleUnavailable")) }
    }
}

struct RecoveryView: View {
    @ObservedObject var model: PasswordRecovery
    let content: MobileContent
    @State private var email = ""
    @State private var password = ""
    @State private var code = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(content.text("recoveryTitle")).font(.title2.bold())
            if model.state.failed { Text(content.text("recoveryFailed")) }
            switch model.state.step {
            case .request:
                TextField(content.text("email"), text: $email).keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never).autocorrectionDisabled().disabled(model.state.busy)
                Button(content.text("sendResetCode")) { let value = email; email = ""; model.request(value) }
                    .disabled(email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.state.busy)
            case .confirm:
                Text(content.text("recoveryInstructions"))
                TextField(content.text("code"), text: $code).textContentType(.oneTimeCode)
                    .keyboardType(.numberPad).disabled(model.state.busy)
                SecureField(content.text("newPassword"), text: $password).textContentType(.newPassword).disabled(model.state.busy)
                Button(content.text("resetPassword")) {
                    let secret = password; let value = code; password = ""; code = ""
                    model.confirm(password: secret, code: value)
                }.disabled(password.isEmpty || code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.state.busy)
            case .complete: Text(content.text("recoveryComplete"))
            case .closed: EmptyView()
            }
            if model.state.busy { ProgressView(content.text("loading")) }
            Button(content.text("backToSignIn")) { email = ""; password = ""; code = ""; model.close() }
        }.textFieldStyle(.roundedBorder).buttonStyle(.borderedProminent)
    }
}
