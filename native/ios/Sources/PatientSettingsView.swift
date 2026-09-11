import SwiftUI

struct PatientSettingsEntry: View {
    @ObservedObject var model: PatientSettingsEditor
    let content: MobileContent
    let busy: Bool
    let open: () -> Void
    var body: some View {
        Button(content.label("settings", "open"), action: open).disabled(busy)
            .sheet(isPresented: Binding(get: { model.state.step != .closed }, set: { if !$0 { model.close() } })) {
                PatientSettingsView(model: model, content: content)
            }
    }
}

struct PatientSettingsView: View {
    @ObservedObject var model: PatientSettingsEditor
    let content: MobileContent
    private var statusKey: String {
        switch model.state.step {
        case .closed: return "CLOSED"
        case .loading: return "LOADING"
        case .editing: return "EDITING"
        case .saving: return "SAVING"
        case .saved: return "SAVED"
        case .loadFailed: return "LOAD_FAILED"
        case .saveUncertain: return "SAVE_UNCERTAIN"
        case .denied: return "DENIED"
        case .missing: return "MISSING"
        }
    }
    private func text(_ key: String) -> String { content.label("settings", key) }
    private func field(_ key: WritableKeyPath<PatientSettingsDraft, String>) -> Binding<String> {
        Binding(get: { model.state.draft?[keyPath: key] ?? "" }, set: { value in
            guard var draft = model.state.draft else { return }
            draft[keyPath: key] = value; model.edit(draft)
        })
    }
    private func optionalField(_ key: WritableKeyPath<PatientSettingsDraft, String?>) -> Binding<String> {
        Binding(get: { model.state.draft?[keyPath: key] ?? "" }, set: { value in
            guard var draft = model.state.draft else { return }
            draft[keyPath: key] = value; model.edit(draft)
        })
    }
    private func preference(_ key: String) -> Binding<Bool?> {
        Binding(get: { model.state.draft?.preferences?[key] }, set: { value in
            guard let value, var draft = model.state.draft else { return }
            var preferences = draft.preferences ?? [:]
            preferences[key] = value; draft.preferences = preferences; model.edit(draft)
        })
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(text("title")).font(.title2.bold())
                Text(content.label("settingsStatus", statusKey))
                if let snapshot = model.state.snapshot, model.state.draft != nil {
                    VStack(alignment: .leading, spacing: 16) {
                        TextField(content.text("fullName"), text: field(\.name))
                            .accessibilityLabel(content.text("fullName")).textContentType(.name)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(content.text("email")).font(.headline)
                            Text(snapshot.email).textSelection(.enabled)
                            Text(text("emailReadOnly")).font(.caption)
                        }
                        TextField(text("phone"), text: optionalField(\.phone))
                            .accessibilityLabel(text("phone")).textContentType(.telephoneNumber).keyboardType(.phonePad)
                        TextField(text("address"), text: optionalField(\.address), axis: .vertical)
                            .accessibilityLabel(text("address")).textContentType(.fullStreetAddress)
                        ForEach(PatientSettingsData.preferenceNames, id: \.self) { key in
                            Picker(content.label("settingsPreferences", key), selection: preference(key)) {
                                if model.state.draft?.preferences?[key] == nil {
                                    Text(text("unset")).tag(Optional<Bool>.none)
                                }
                                Text(text("enabled")).tag(Optional.some(true))
                                Text(text("disabled")).tag(Optional.some(false))
                            }.accessibilityIdentifier(NativeUITestProtocol.settingsPreferencePrefix + key)
                        }
                    }.disabled(!model.state.editable)
                    if model.state.invalid { Text(text("invalid")).foregroundStyle(content.color("error")) }
                    Button(text("save"), action: model.save).disabled(!model.state.editable)
                    Button(text("discard"), action: model.discard).disabled(!model.state.editable)
                }
                if !model.state.busy && !model.state.editable {
                    Button(text("reload"), action: model.reload)
                }
                Button(text("close"), action: model.close)
            }
            .textFieldStyle(.roundedBorder).buttonStyle(.bordered)
            .frame(maxWidth: .infinity, alignment: .leading).padding(24)
        }
        .background(content.color("background"))
        .foregroundStyle(content.color("foreground"))
        .tint(content.color("accent"))
    }
}
