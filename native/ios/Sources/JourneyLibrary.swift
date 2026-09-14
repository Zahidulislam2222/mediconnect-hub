import SwiftUI

struct JourneyLibrary: View {
    let journey: NativeJourney
    let content: MobileContent
    let kind: EditorialKind
    @State private var query = ""
    @State private var category: String?
    @FocusState private var searchFocused: Bool
    private var editorial: NativeEditorial { journey.editorial }
    private var copy: EditorialCopy { editorial.copy(kind) }
    private var articles: [EditorialArticle] { editorial.filtered(kind, query: query, category: category) }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text(copy.eyebrow).font(.subheadline)
                Text(copy.title).font(.largeTitle).accessibilityAddTraits(.isHeader)
                Text(copy.body)
                if kind == .knowledge {
                    TextField(editorial.placeholder, text: $query)
                        .accessibilityLabel(editorial.search).textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled().textInputAutocapitalization(.never)
                        .focused($searchFocused).submitLabel(.search).onSubmit { searchFocused = false }
                    ScrollView(.horizontal) {
                        HStack {
                            categoryButton(editorial.all, value: nil)
                            ForEach(editorial.categories(), id: \.self) { categoryButton($0, value: $0) }
                        }
                    }.accessibilityLabel(editorial.categoriesLabel)
                }
                Text("\(articles.count) \(kind == .knowledge ? editorial.guides : editorial.stories)")
                    .accessibilityIdentifier("editorial-result-count")
                ForEach(articles) { article in
                    NavigationLink {
                        JourneyArticle(journey: journey, content: content, kind: kind, slug: article.slug)
                    } label: {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("\(article.category) · \(article.minutes) \(editorial.minutesRead)").font(.caption)
                            Text(article.title).font(.title2).accessibilityAddTraits(.isHeader)
                            Text(article.summary)
                            Text(copy.read).foregroundStyle(content.color("accent"))
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(24)
                            .background(content.color("surface"), in: RoundedRectangle(cornerRadius: 24))
                    }.buttonStyle(.plain).accessibilityIdentifier("editorial-article-\(article.slug)")
                }
                if articles.isEmpty {
                    Text(editorial.empty).font(.title2).accessibilityAddTraits(.isHeader)
                    Button(editorial.clear) { query = ""; category = nil }.buttonStyle(.borderedProminent)
                }
                Text(copy.disclaimer).font(.footnote)
            }.padding(24).frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .navigationTitle(kind == .knowledge ? editorial.knowledgeLink : editorial.journalLink)
        .navigationBarTitleDisplayMode(.inline)
        .background(content.color("background")).foregroundStyle(content.color("foreground"))
    }
    private func categoryButton(_ title: String, value: String?) -> some View {
        Button(title) { category = value }.buttonStyle(.bordered)
            .accessibilityAddTraits(category == value ? .isSelected : [])
    }
}

struct JourneyArticle: View {
    let journey: NativeJourney
    let content: MobileContent
    let kind: EditorialKind
    let slug: String
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        let editorial = journey.editorial
        let copy = editorial.copy(kind)
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Button(copy.back) { dismiss() }
                if let article = editorial.article(kind, slug: slug) {
                    Text("\(article.category) · \(article.minutes) \(editorial.minutesRead)").font(.caption)
                    Text(article.title).font(.largeTitle).accessibilityAddTraits(.isHeader)
                    Text(article.summary).font(.title3)
                    Text(copy.disclaimer).font(.footnote)
                    ForEach(Array(article.sections.enumerated()), id: \.offset) { _, section in
                        Text(section.heading).font(.title2).accessibilityAddTraits(.isHeader)
                        Text(section.body)
                    }
                    Text(journey.brand)
                    Button(copy.back) { dismiss() }
                } else { Text(editorial.notFound).font(.title2) }
            }.padding(24).frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }.navigationBarTitleDisplayMode(.inline)
            .background(content.color("background")).foregroundStyle(content.color("foreground"))
    }
}
