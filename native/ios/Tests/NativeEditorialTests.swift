import XCTest
@testable import MediConnectApp

final class NativeEditorialTests: XCTestCase {
    private func document() throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "journey", withExtension: "json"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }
    private func editorial(_ source: [String: Any]) throws -> NativeEditorial {
        try NativeEditorial(data: JSONSerialization.data(withJSONObject: source))
    }
    private func replacingArticle(_ key: String, _ value: Any) throws -> [String: Any] {
        var source = try document()
        var articles = try XCTUnwrap(source["articles"] as? [[String: Any]])
        articles[0][key] = value; source["articles"] = articles
        return source
    }
    func testCanonicalArticlesAreCompleteAndKindScoped() throws {
        let source = try document(); let content = try editorial(source)
        XCTAssertEqual(content.articles.count, (source["articles"] as? [Any])?.count)
        for kind in EditorialKind.allCases {
            XCTAssertFalse(content.filtered(kind).isEmpty)
            XCTAssertTrue(content.filtered(kind).allSatisfy { $0.kind == kind && !$0.sections.isEmpty })
        }
        let article = try XCTUnwrap(content.articles.first)
        XCTAssertEqual(content.article(article.kind, slug: article.slug)?.title, article.title)
        XCTAssertNil(content.article(article.kind == .knowledge ? .journal : .knowledge, slug: article.slug))
        XCTAssertNil(content.article(article.kind, slug: "missing-test-article"))
    }
    func testSearchCombinesCategoryAndAllFourFields() throws {
        let content = try editorial(document()); let article = try XCTUnwrap(content.filtered(.knowledge).first)
        for query in [article.title, article.summary, article.category, article.audience] {
            XCTAssertTrue(content.filtered(.knowledge, query: query.uppercased(), category: article.category).contains { $0.slug == article.slug })
        }
        XCTAssertTrue(content.filtered(.knowledge, query: article.title, category: "missing-test-category").isEmpty)
        XCTAssertTrue(content.filtered(.knowledge, query: "missing-test-search").isEmpty)
        XCTAssertEqual(content.filtered(.journal).map(\.slug), content.filtered(.journal, query: "ignored-test-query", category: "ignored-test-category").map(\.slug))
    }
    func testRejectsDuplicateSlugsAndUnknownKinds() throws {
        var source = try document(); var articles = try XCTUnwrap(source["articles"] as? [[String: Any]])
        articles.append(try XCTUnwrap(articles.first)); source["articles"] = articles
        XCTAssertThrowsError(try editorial(source))
        XCTAssertThrowsError(try editorial(replacingArticle("kind", "unknown")))
    }
    func testRejectsMalformedTimesAndMissingSections() throws {
        let values: [Any] = [0, -1, 1.5, "3", true, NSNull()]
        for minutes in values {
            XCTAssertThrowsError(try editorial(replacingArticle("minutes", minutes)))
        }
        XCTAssertThrowsError(try editorial(replacingArticle("sections", [])))
    }
    func testRejectsBlankArticleSectionAndInterfaceCopy() throws {
        for key in ["slug", "category", "audience", "title", "summary"] {
            XCTAssertThrowsError(try editorial(replacingArticle(key, " ")))
        }
        XCTAssertThrowsError(try editorial(replacingArticle("sections", [["heading": "test heading", "body": " "]])))
        var source = try document(); var copy = try XCTUnwrap(source["library"] as? [String: Any])
        copy["disclaimer"] = " "; source["library"] = copy
        XCTAssertThrowsError(try editorial(source))
    }
    func testBothPublicDestinationsRequireContent() throws {
        var source = try document(); let articles = try XCTUnwrap(source["articles"] as? [[String: Any]])
        source["articles"] = articles.filter { ($0["kind"] as? String) == "knowledge" }
        XCTAssertThrowsError(try editorial(source))
    }
}
