import SwiftUI

struct JourneyDemoWorkspace: View {
    let journey: NativeJourney
    let content: MobileContent
    @Binding var state: DemoState
    @Environment(\.dismiss) private var dismiss
    @FocusState private var editing: Bool
    private var demo: NativeDemo { journey.demo }
    private var copy: DemoCopy { demo.copy }
    private var sample: DemoSample { demo.sample }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Button(journey.home) { dismiss() }
                Text(copy.eyebrow)
                heading(state.role == .staff ? copy.staff : state.role == .doctor ? copy.doctor : copy.patient)
                Button(copy.reset) { editing = false; state.reset(demo) }.buttonStyle(.bordered)
                VStack(alignment: .leading) {
                    ForEach(demo.roles) { role in
                        Button(role.label) { editing = false; state.role = role.id }
                            .buttonStyle(.bordered)
                            .accessibilityAddTraits(state.role == role.id ? .isSelected : [])
                    }
                }.accessibilityElement(children: .contain).accessibilityLabel(demo.workspaceLabel)
                Text(copy.notice).font(.footnote)
                if state.visit { consultation } else { appointment; preparation }
            }.padding(24).frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .background(content.color("background")).foregroundStyle(content.color("foreground"))
        .tint(content.color("accent"))
        .navigationTitle(demo.workspaceLabel).navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("demo-workspace")
    }
    private var consultation: some View {
        VStack(alignment: .leading, spacing: 20) {
            Button(copy.close) { state.visit = false }.buttonStyle(.bordered)
            if let image = JourneyPoster.image(journey.homePoster) {
                Image(uiImage: image).resizable().aspectRatio(contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 24)).accessibilityLabel(journey.imageDescription)
            } else { Text(journey.imageDescription) }
            Text(state.role == .doctor ? sample.patient : sample.doctor)
            heading(copy.callTitle)
            Toggle(state.mic ? copy.micOn : copy.micOff, isOn: $state.mic)
            Toggle(state.camera ? copy.camOn : copy.camOff, isOn: $state.camera)
            Text(copy.callNotice).font(.footnote)
        }
    }
    private var appointment: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(state.role == .doctor ? copy.queue : copy.appointment)
            Text(state.role == .patient ? sample.doctorInitials : sample.patientInitials)
            heading(state.role == .patient ? sample.doctor : sample.patient)
            Text(sample.appointment + " · " + (state.role == .staff ? sample.doctor : demo.tagline))
            Text(sample.date + ", " + sample.year); Text(sample.timezone)
            Text(state.slot).accessibilityIdentifier("demo-selected-slot")
            Text(copy.choose)
            ForEach(sample.slots, id: \.self) { slot in
                Button(slot) { try? state.selectSlot(slot, content: demo) }.buttonStyle(.bordered)
                    .accessibilityAddTraits(state.slot == slot ? .isSelected : [])
            }
            Text(state.ready ? copy.ready : copy.pending).accessibilityIdentifier("demo-readiness")
            if state.role == .staff {
                Button(copy.toggle) { state.ready.toggle() }.buttonStyle(.bordered)
            } else {
                Button(copy.consult) { editing = false; state.visit = true }.buttonStyle(.borderedProminent)
            }
        }
    }
    private var preparation: some View {
        VStack(alignment: .leading, spacing: 12) {
            if state.role == .staff {
                if let article = journey.editorial.article(.knowledge, slug: copy.coordinationArticleSlug) {
                    Text(journey.editorial.knowledgeLink); heading(article.title); Text(article.summary)
                }
            } else {
                Text(copy.followup); heading(copy.notes)
                if state.role == .doctor {
                    Text(state.note).accessibilityIdentifier("demo-saved-note")
                } else {
                    TextField(copy.notes, text: Binding(get: { state.draft }, set: { state.editNote($0, content: demo) }), axis: .vertical)
                        .lineLimit(4...8).textFieldStyle(.roundedBorder).focused($editing)
                        .accessibilityIdentifier("demo-note")
                    Text(copy.noteHint).font(.footnote)
                    Button(copy.save) { editing = false; state.saveNote() }.buttonStyle(.bordered)
                    if state.saved { Text(copy.saved).accessibilityIdentifier("demo-note-saved") }
                }
                Text(copy.followupBody)
            }
            NavigationLink(journey.editorial.knowledge.read) {
                JourneyArticle(journey: journey, content: content, kind: .knowledge,
                               slug: state.role == .staff ? copy.coordinationArticleSlug : copy.preparationArticleSlug)
            }.simultaneousGesture(TapGesture().onEnded { editing = false })
        }
    }
    private func heading(_ value: String) -> some View {
        Text(value).font(.title2).accessibilityAddTraits(.isHeader)
    }
}
