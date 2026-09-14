import SwiftUI

struct ProfileSetupView: View {
    @ObservedObject var model: ProfileEnrollment
    let role: Role
    let content: MobileContent
    let policies: MobilePolicies
    @State private var name = ""
    @State private var email = ""
    @State private var specialization = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(content.text("profileSetup")).font(.title2)
            switch model.state.step {
            case .missing:
                Text(content.text("profileSetupInstructions"))
                TextField(content.text("fullName"), text: $name).textContentType(.name).disabled(model.state.busy)
                TextField(content.text("email"), text: $email).textContentType(.emailAddress).keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never).autocorrectionDisabled().disabled(model.state.busy)
                if role == .doctor { TextField(content.text("specialization"), text: $specialization).disabled(model.state.busy) }
                PolicyLinks(policies: policies, content: content)
                Toggle(policies.acceptance, isOn: Binding(get: { model.state.accepted }, set: model.accept)).disabled(model.state.busy)
                Button(content.text("saveProfile")) { model.submit(name: name, email: email, specialization: specialization) }
                    .disabled(model.state.busy || !model.state.accepted || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                              || email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                              || (role == .doctor && specialization.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty))
            case .failed:
                Text(content.text("profileCheckFailed"))
                Button(content.text("checkProfile"), action: model.check).disabled(model.state.busy)
            case .checking: ProgressView(content.text("loading"))
            default: EmptyView()
            }
        }.textFieldStyle(.roundedBorder).buttonStyle(.borderedProminent)
    }
}
