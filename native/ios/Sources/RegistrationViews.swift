import SwiftUI

struct PolicyLinks: View {
    let policies: MobilePolicies
    let content: MobileContent
    @State private var selected: String?
    var body: some View {
        VStack(alignment: .leading) {
            ForEach(policies.pages.keys.sorted(), id: \.self) { key in
                Button(policies.pages[key]?.title ?? key) { selected = key }
                    .accessibilityIdentifier("policy-\(key)")
            }
        }
        .sheet(isPresented: Binding(get: { selected != nil }, set: { if !$0 { selected = nil } })) {
            if let key = selected, let page = policies.pages[key] {
                PolicyReader(page: page, policies: policies, content: content) { selected = nil }.id(key)
            }
        }
    }
}

private struct PolicyReader: View {
    let page: PolicyPage
    let policies: MobilePolicies
    let content: MobileContent
    let close: () -> Void
    @Environment(\.openURL) private var openURL
    @State private var linkFailed = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("\(content.text("policyUpdated")) \(policies.updated)")
                        .accessibilityIdentifier("policy-updated")
                    Text(policies.notice)
                    ForEach(page.sections.indices, id: \.self) { index in
                        Text(page.sections[index].title).font(.headline)
                        Text(page.sections[index].body).accessibilityIdentifier("policy-section-\(index)")
                    }
                    ForEach(page.sources.indices, id: \.self) { index in
                        Button {
                            guard let url = URL(string: page.sources[index].url) else { linkFailed = true; return }
                            openURL(url) { accepted in linkFailed = !accepted }
                        } label: {
                            VStack(alignment: .leading) {
                                Text(page.sources[index].label).font(.headline)
                                Text(page.sources[index].url)
                            }
                        }.accessibilityIdentifier("policy-source-\(index)")
                    }
                }.padding()
            }.accessibilityIdentifier("policy-body")
                .navigationTitle(page.title)
                .safeAreaInset(edge: .bottom) {
                    if linkFailed { Text(content.text("policyLinkFailed")).padding().accessibilityIdentifier("policy-link-failed") }
                }
                .toolbar { Button(content.text("close"), action: close).accessibilityIdentifier("policy-close") }
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
