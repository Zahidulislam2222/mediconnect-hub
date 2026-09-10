import Foundation

struct JourneyChapter: Decodable, Identifiable {
    let id: String
    let label: String
    let title: String
    let emphasis: String
    let body: String
}

struct NativeJourney {
    let editorial: NativeEditorial
    let brand: String
    let notice: String
    let hero: JourneyChapter
    let login: String
    let home: String
    let illustration: String
    let imageDescription: String
    let poster: String
    let homePoster: String
    let chapters: [JourneyChapter]

    init(data: Data) throws {
        editorial = try NativeEditorial(data: data)
        struct Hero: Decodable { let eyebrow: String; let title: String; let emphasis: String; let body: String; let illustration: String }
        struct Navigation: Decodable { let login: String; let home: String }
        struct Media: Decodable { let poster: String; let homePoster: String; let alt: String }
        struct Document: Decodable {
            let brand: String; let notice: String; let hero: Hero
            let navigation: Navigation; let media: Media; let stages: [JourneyChapter]
        }
        let document = try JSONDecoder().decode(Document.self, from: data)
        let values = [document.brand, document.notice, document.hero.eyebrow, document.hero.title,
                      document.hero.emphasis, document.hero.body, document.hero.illustration,
                      document.navigation.login, document.navigation.home, document.media.alt] +
            document.stages.flatMap { [$0.id, $0.label, $0.title, $0.emphasis, $0.body] }
        guard values.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }),
              !document.stages.isEmpty, Set(document.stages.map(\.id)).count == document.stages.count else {
            throw MobileFailure.configuration
        }
        func asset(_ path: String) throws -> String {
            guard path.range(of: "^/media/journey/[A-Za-z0-9_-]+\\.webp$", options: .regularExpression) != nil else {
                throw MobileFailure.configuration
            }
            return (path as NSString).lastPathComponent
        }
        brand = document.brand; notice = document.notice
        hero = JourneyChapter(id: "hero", label: document.hero.eyebrow, title: document.hero.title,
                              emphasis: document.hero.emphasis, body: document.hero.body)
        login = document.navigation.login; home = document.navigation.home
        illustration = document.hero.illustration; imageDescription = document.media.alt
        poster = try asset(document.media.poster); homePoster = try asset(document.media.homePoster)
        chapters = document.stages
    }
}
