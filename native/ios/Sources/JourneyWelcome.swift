import SwiftUI
import UIKit
import ImageIO

enum JourneyPoster {
    static func image(_ name: String) -> UIImage? {
        guard let url = Bundle.main.url(forResource: name, withExtension: nil),
              let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { return nil }
        return UIImage(cgImage: image)
    }
}

struct JourneyWelcome: View {
    let journey: NativeJourney
    let content: MobileContent
    let signIn: () -> Void
    var body: some View {
        NavigationStack {
            home.navigationTitle(journey.home).navigationBarTitleDisplayMode(.inline)
        }.tint(content.color("accent"))
    }
    private var home: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text(journey.brand).font(.title2.weight(.medium))
                Button(journey.login, action: signIn).buttonStyle(.borderedProminent)
                NavigationLink(journey.editorial.knowledgeLink) {
                    JourneyLibrary(journey: journey, content: content, kind: .knowledge)
                }
                NavigationLink(journey.editorial.journalLink) {
                    JourneyLibrary(journey: journey, content: content, kind: .journal)
                }
                copy(journey.hero)
                poster(journey.poster)
                Text(journey.illustration).font(.caption)
                ForEach(journey.chapters.dropFirst()) { chapter in
                    copy(chapter).padding(24).frame(maxWidth: .infinity, alignment: .leading)
                        .background(content.color("surface"), in: RoundedRectangle(cornerRadius: 24))
                }
                poster(journey.homePoster)
                Text(journey.notice).font(.footnote).fixedSize(horizontal: false, vertical: true)
                Button(journey.login, action: signIn).buttonStyle(.borderedProminent)
            }
            .padding(24).frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(content.color("background"))
        .foregroundStyle(content.color("foreground"))
        .tint(content.color("accent"))
    }
    private func copy(_ chapter: JourneyChapter) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(chapter.label).font(.subheadline.weight(.medium))
            Text(chapter.title + "\n" + chapter.emphasis).font(.largeTitle.weight(.medium))
                .accessibilityAddTraits(.isHeader)
            Text(chapter.body).font(.body)
        }.fixedSize(horizontal: false, vertical: true)
    }
    @ViewBuilder private func poster(_ name: String) -> some View {
        if let image = JourneyPoster.image(name) {
            Image(uiImage: image).resizable().aspectRatio(contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 24)).accessibilityLabel(journey.imageDescription)
        } else { Text(journey.imageDescription) }
    }
}

struct NativeEntry: View {
    @ObservedObject var model: WorkspaceModel
    let content: MobileContent
    let journey: NativeJourney?
    @ObservedObject private var recovery: PasswordRecovery
    @ObservedObject private var registration: AccountRegistration
    @State private var welcome = true
    init(model: WorkspaceModel, content: MobileContent, journey: NativeJourney?) {
        self.model = model; self.content = content; self.journey = journey
        self.recovery = model.recovery; self.registration = model.registration
    }
    private var canReturnHome: Bool {
        model.identity == nil && !model.busy && !model.challenge &&
            recovery.state.step == .closed && registration.state.step == .closed
    }
    var body: some View {
        if welcome, model.identity == nil, !model.challenge, let journey {
            JourneyWelcome(journey: journey, content: content) { welcome = false }
        } else {
            VStack(spacing: 0) {
                if !welcome, canReturnHome, let journey {
                    Button(journey.home) { welcome = true }.padding()
                }
                WorkspaceView(model: model, content: content, recovery: model.recovery,
                              registration: model.registration, profile: model.profile, cancellation: model.cancellation)
            }
        }
    }
}
