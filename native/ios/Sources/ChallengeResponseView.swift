import SwiftUI
import Amplify
import AWSCognitoAuthPlugin

struct ChallengeResponseView: View {
    let input: ChallengeInput
    let content: MobileContent
    let busy: Bool
    let confirm: (String) -> Void
    let cancel: () -> Void
    var choices: [MFAType] = []
    var setup: AuthenticatorSetup? = nil
    @State private var response = ""
    @State private var revealSetup = false
    @Environment(\.scenePhase) private var phase
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if input == .totpSetup {
                Text(content.text("authenticatorSetupInstructions"))
                if let setup {
                    Button(content.text(revealSetup ? "hideSetupKey" : "revealSetupKey")) { revealSetup.toggle() }
                    if revealSetup { Text(setup.displayKey).font(.system(.body, design: .monospaced)).privacySensitive() }
                }
            }
            if !choices.isEmpty {
                Text(content.text("chooseMfa")).font(.headline)
                ForEach(choices, id: \.self) { choice in
                    Button(content.text(SignInChallenge.label(choice))) { confirm(choice.challengeResponse) }
                }
            } else if input == .email {
                Text(content.text("mfaEmailSetupInstructions"))
                TextField(content.text("mfaEmailAddress"), text: $response).textContentType(.emailAddress)
                    .keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
            } else if input == .code || input == .totpSetup {
                SecureField(content.text("code"), text: $response).textContentType(.oneTimeCode).keyboardType(.numberPad)
            } else {
                SecureField(content.text(input == .newPassword ? "newPassword" : "password"), text: $response)
                    .textContentType(input == .newPassword ? .newPassword : .password)
            }
            if choices.isEmpty {
                Button(content.text("verify")) {
                    let value = response; response = ""; revealSetup = false; confirm(value)
                }.disabled(busy || SignInChallenge.response(input, value: response) == nil || (input == .totpSetup && setup == nil))
            }
            Button(content.text("cancel")) { response = ""; revealSetup = false; cancel() }
        }.textFieldStyle(.roundedBorder).buttonStyle(.borderedProminent).disabled(busy)
            .onChange(of: choices) { _ in response = "" }
            .onChange(of: setup) { _ in response = ""; revealSetup = false }
            .onChange(of: phase) { value in if value != .active { response = ""; revealSetup = false } }
    }
}
