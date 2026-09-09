import SwiftUI

struct ChallengeResponseView: View {
    let input: ChallengeInput
    let content: MobileContent
    let busy: Bool
    let confirm: (String) -> Void
    let cancel: () -> Void
    @State private var response = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if input == .code {
                SecureField(content.text("code"), text: $response).textContentType(.oneTimeCode).keyboardType(.numberPad)
            } else {
                SecureField(content.text(input == .newPassword ? "newPassword" : "password"), text: $response)
                    .textContentType(input == .newPassword ? .newPassword : .password)
            }
            Button(content.text("verify")) {
                let value = response; response = ""; confirm(value)
            }.disabled(busy || SignInChallenge.response(input, value: response) == nil)
            Button(content.text("cancel")) { response = ""; cancel() }
        }.textFieldStyle(.roundedBorder).buttonStyle(.borderedProminent).disabled(busy)
    }
}
