import Foundation

enum EditorialKind: String, Decodable, CaseIterable { case knowledge; case journal = "blog" }
struct EditorialSection: Decodable { let heading: String; let body: String }
struct EditorialArticle: Decodable, Identifiable {
    let slug: String; let kind: EditorialKind; let category: String; let audience: String
    let title: String; let summary: String; let minutes: Int; let sections: [EditorialSection]
    var id: String { slug }
}
struct EditorialCopy: Decodable {
    let title: String; let body: String; let eyebrow: String
    let back: String; let read: String; let disclaimer: String
    var strings: [String] { [title, body, eyebrow, back, read, disclaimer] }
}
struct NativeEditorial {
    let knowledge: EditorialCopy; let journal: EditorialCopy
    let search: String; let placeholder: String; let all: String; let empty: String; let clear: String
    let categoriesLabel: String; let minutesRead: String; let guides: String; let stories: String
    let knowledgeLink: String; let journalLink: String; let notFound: String
    let articles: [EditorialArticle]
    init(data: Data) throws {
        struct Library: Decodable { let search: String; let placeholder: String; let all: String; let empty: String; let clear: String }
        struct Labels: Decodable { let categories: String; let minutesRead: String; let guides: String; let stories: String }
        struct Navigation: Decodable { let knowledge: String; let blog: String }
        struct Footer: Decodable { let notFound: String }
        struct Document: Decodable {
            let library: EditorialCopy; let journal: EditorialCopy; let labels: Labels
            let navigation: Navigation; let footer: Footer; let articles: [EditorialArticle]
        }
        struct SearchDocument: Decodable { let library: Library }
        let decoder = JSONDecoder()
        let document = try decoder.decode(Document.self, from: data)
        let library = try decoder.decode(SearchDocument.self, from: data).library
        let strings = document.library.strings + document.journal.strings +
            [library.search, library.placeholder, library.all, library.empty, library.clear,
             document.labels.categories, document.labels.minutesRead, document.labels.guides, document.labels.stories,
             document.navigation.knowledge, document.navigation.blog, document.footer.notFound] +
            document.articles.flatMap { [$0.slug, $0.category, $0.audience, $0.title, $0.summary] +
                $0.sections.flatMap { [$0.heading, $0.body] } }
        guard strings.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }),
              EditorialKind.allCases.allSatisfy({ kind in document.articles.contains { $0.kind == kind } }),
              Set(document.articles.map(\.slug)).count == document.articles.count,
              document.articles.allSatisfy({ $0.minutes > 0 && $0.minutes <= Int(Int32.max) && !$0.sections.isEmpty }) else {
            throw MobileFailure.configuration
        }
        knowledge = document.library; journal = document.journal
        search = library.search; placeholder = library.placeholder; all = library.all
        empty = library.empty; clear = library.clear
        categoriesLabel = document.labels.categories; minutesRead = document.labels.minutesRead
        guides = document.labels.guides; stories = document.labels.stories
        knowledgeLink = document.navigation.knowledge; journalLink = document.navigation.blog
        notFound = document.footer.notFound; articles = document.articles
    }
    func copy(_ kind: EditorialKind) -> EditorialCopy { kind == .knowledge ? knowledge : journal }
    func categories() -> [String] {
        articles.filter { $0.kind == .knowledge }.map(\.category).reduce(into: []) { result, category in
            if !result.contains(category) { result.append(category) }
        }
    }
    func article(_ kind: EditorialKind, slug: String) -> EditorialArticle? {
        articles.first { $0.kind == kind && $0.slug == slug }
    }
    func filtered(_ kind: EditorialKind, query: String = "", category: String? = nil) -> [EditorialArticle] {
        articles.filter {
            $0.kind == kind && (kind == .journal || ((category == nil || $0.category == category) &&
                "\($0.title) \($0.summary) \($0.category) \($0.audience)".lowercased().contains(query.lowercased())))
        }
    }
}
