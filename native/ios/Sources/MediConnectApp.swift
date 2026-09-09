import SwiftUI

@main
struct MediConnectApp: App {
    @StateObject private var model = WorkspaceModel()
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup {
            if let content = model.content {
                WorkspaceView(model: model, content: content)
                    .onChange(of: phase) { value in if value == .active { model.resume() } else { model.hide() } }
                    .task { if phase == .active { model.resume() } }
            }
        }
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
                        if !model.configured { Text(content.text("configurationUnavailable")) }
                        else {
                            if let message = model.message { Text(content.text(message)).foregroundStyle(content.color("error")) }
                            if let identity = model.identity { workspace(identity) }
                            else { signInForm }
                            if model.busy { ProgressView(content.text("loading")) }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading).padding(24)
            }
            .background(content.color("background"))
            .foregroundStyle(content.color("foreground"))
            .tint(content.color("accent"))
            .onChange(of: model.visible) { visible in if !visible { email = ""; password = ""; code = "" } }
        }
    }
    private var signInForm: some View {
        VStack(alignment: .leading, spacing: 16) {
            if model.challenge {
                TextField(content.text("code"), text: $code).textContentType(.oneTimeCode).keyboardType(.numberPad)
                Button(content.text("verify")) { let value = code; code = ""; model.confirm(code: value) }
                    .disabled(code.isEmpty || model.busy)
                Button(content.text("cancel"), action: model.signOut)
            } else {
                TextField(content.text("email"), text: $email).textContentType(.username)
                    .keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                SecureField(content.text("password"), text: $password).textContentType(.password)
                Button(content.text("signIn")) { let value = password; password = ""; model.signIn(email: email, password: value) }
                    .disabled(email.isEmpty || password.isEmpty || model.busy)
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
            HStack {
                Text(content.text("appointments")).font(.title2.bold())
                Spacer()
                Button(content.text("refresh")) { model.refresh() }.disabled(model.busy)
            }
            if !model.busy && model.message == nil && model.appointments.isEmpty { Text(content.text("emptyAppointments")) }
            ForEach(model.appointments) { appointment in
                VStack(alignment: .leading, spacing: 8) {
                    Text(appointment.person ?? content.text("unknown")).font(.headline)
                    if let time = appointment.time { Text(time, format: .dateTime) }
                    else { Text(content.text("unknown")) }
                    Text(appointment.status ?? content.text("unknown")).foregroundStyle(content.color("muted"))
                }
                .frame(maxWidth: .infinity, alignment: .leading).padding(20)
                .background(content.color("surface"), in: RoundedRectangle(cornerRadius: 10))
            }
            if model.next != nil { Button(content.text("loadMore")) { model.refresh(more: true) }.disabled(model.busy) }
        } else { Text(content.text("roleUnavailable")) }
    }
}
