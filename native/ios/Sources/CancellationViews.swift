import SwiftUI

struct CancellationView: View {
    @ObservedObject var model: AppointmentCancellation
    let content: MobileContent
    let close: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(content.text("cancelAppointment")).font(.title2)
            if let person = model.state.appointment?.person { Text(person) }
            switch model.state.step {
            case .confirm:
                Text(content.text("cancelConfirmation"))
                Button(content.text("confirmCancellation"), role: .destructive) { model.confirm() }
            case .processing: ProgressView(content.text("loading"))
            case .confirmed: Text(content.text("cancellationConfirmed"))
            case .unconfirmed:
                Text(content.text("cancellationUnconfirmed"))
                Button(content.text("checkCancellation")) { model.check() }
            case .closed: EmptyView()
            }
            Button(content.text(model.state.step == .confirm ? "keepAppointment" : "close"), action: close)
        }.padding().buttonStyle(.bordered)
    }
}
