import SwiftUI

struct PolicyLinks: View {
    let policies: MobilePolicies
    let content: MobileContent
    @State private var selected: String?
    var body: some View {
        VStack(alignment: .leading) {
            ForEach(policies.pages.keys.sorted(), id: \.self) { key in
                Button(policies.pages[key]?.title ?? key) { selected = key }
            }
        }
        .sheet(isPresented: Binding(get: { selected != nil }, set: { if !$0 { selected = nil } })) {
            if let key = selected, let page = policies.pages[key] {
                NavigationStack {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            Text(policies.notice)
                            ForEach(page.sections.indices, id: \.self) { index in
                                Text(page.sections[index].title).font(.headline)
                                Text(page.sections[index].body)
                            }
                            ForEach(page.sources.indices, id: \.self) { index in
                                Text(page.sources[index].label).font(.headline)
                                Text(page.sources[index].url).textSelection(.enabled)
                            }
                        }.padding()
                    }.navigationTitle(page.title)
                        .toolbar { Button(content.text("close")) { selected = nil } }
                }
            }
        }
    }
}

struct RegistrationView: View {
    @ObservedObject var model: AccountRegistration
    let content: MobileContent
    let policies: MobilePolicies
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var code = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(content.text("createAccount")).font(.title2.bold())
            if model.state.failed { Text(content.text("registrationFailed")) }
            switch model.state.step {
            case .details:
                TextField(content.text("fullName"), text: $name).textContentType(.name).disabled(model.state.busy)
                TextField(content.text("email"), text: $email).keyboardType(.emailAddress).textContentType(.username)
                    .textInputAutocapitalization(.never).autocorrectionDisabled().disabled(model.state.busy)
                SecureField(content.text("password"), text: $password).textContentType(.newPassword).disabled(model.state.busy)
                Text(policies.notice)
                PolicyLinks(policies: policies, content: content)
                Toggle(policies.acceptance, isOn: Binding(get: { model.state.accepted }, set: model.accept)).disabled(model.state.busy)
                Button(content.text("register")) {
                    let secret = password; password = ""; model.register(email: email, password: secret, name: name)
                }.disabled(model.state.busy || !model.state.accepted || email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                           || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || password.isEmpty)
            case .confirm:
                Text(content.text("registrationInstructions"))
                TextField(content.text("code"), text: $code).textContentType(.oneTimeCode).keyboardType(.numberPad).disabled(model.state.busy)
                Button(content.text("verify")) { let value = code; code = ""; model.confirm(value) }
                    .disabled(model.state.busy || code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button(content.text("resendCode"), action: model.resend).disabled(model.state.busy)
                if model.state.codeRequested { Text(content.text("registrationCodeRequested")) }
            case .complete: Text(content.text("registrationComplete"))
            case .closed: EmptyView()
            }
            if model.state.busy { ProgressView(content.text("loading")) }
            Button(content.text("backToSignIn")) { name = ""; email = ""; password = ""; code = ""; model.close() }
        }.textFieldStyle(.roundedBorder).buttonStyle(.borderedProminent)
    }
}
