import XCTest

final class NativeEditorialUITests: XCTestCase {
    private struct Fixture: Decodable {
        struct Navigation: Decodable { let knowledge: String; let blog: String; let home: String }
        struct Library: Decodable { let search: String; let empty: String; let clear: String; let back: String; let disclaimer: String }
        struct Journal: Decodable { let disclaimer: String }
        struct Article: Decodable {
            struct Section: Decodable { let body: String }
            let slug: String; let kind: String; let title: String; let category: String; let audience: String
            let sections: [Section]
        }
        let navigation: Navigation; let library: Library; let journal: Journal; let articles: [Article]
    }
    private func fixture() throws -> Fixture {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "journey", withExtension: "json"))
        return try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
    }
    private func reveal(_ element: XCUIElement, in app: XCUIApplication) {
        for _ in 0..<20 {
            if element.isHittable { return }
            app.swipeUp()
        }
        XCTAssertTrue(element.isHittable)
    }
    func testKnowledgeSearchArticleAndBackPreserveQuery() throws {
        let source = try fixture(); let article = try XCTUnwrap(source.articles.first { $0.kind == "knowledge" })
        let app = XCUIApplication(); app.launch()
        let link = app.buttons[source.navigation.knowledge]
        XCTAssertTrue(link.waitForExistence(timeout: 10)); link.tap()
        let search = app.textFields[source.library.search]
        search.tap(); search.typeText(article.title.uppercased() + "\n")
        let card = app.buttons["editorial-article-\(article.slug)"]
        reveal(card, in: app); card.tap()
        let lastBody = app.staticTexts[try XCTUnwrap(article.sections.last).body]
        reveal(lastBody, in: app)
        let back = app.buttons.matching(identifier: source.library.back).element(boundBy: 1)
        reveal(back, in: app); back.tap()
        for _ in 0..<10 { if search.isHittable { break }; app.swipeDown() }
        XCTAssertEqual(search.value as? String, article.title.uppercased())
        app.navigationBars.buttons[source.navigation.home].tap()
        XCTAssertTrue(app.buttons[source.navigation.blog].exists)
    }
    func testEmptySearchAndCategoryCanBeCleared() throws {
        let source = try fixture(); let article = try XCTUnwrap(source.articles.first { $0.kind == "knowledge" })
        let app = XCUIApplication(); app.launch()
        XCTAssertTrue(app.buttons[source.navigation.knowledge].waitForExistence(timeout: 10))
        app.buttons[source.navigation.knowledge].tap()
        app.buttons[article.category].tap()
        let search = app.textFields[source.library.search]
        search.tap(); search.typeText("missing-test-search\n")
        reveal(app.staticTexts[source.library.empty], in: app)
        app.buttons[source.library.clear].tap()
        XCTAssertFalse(app.staticTexts[source.library.empty].exists)
        reveal(app.buttons["editorial-article-\(article.slug)"], in: app)
    }
    func testJournalLargeTextArticleRemainsReadable() throws {
        let source = try fixture(); let article = try XCTUnwrap(source.articles.first { $0.kind == "blog" })
        let app = XCUIApplication()
        app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        let link = app.buttons[source.navigation.blog]
        XCTAssertTrue(link.waitForExistence(timeout: 10)); reveal(link, in: app); link.tap()
        XCTAssertFalse(app.textFields[source.library.search].exists)
        let card = app.buttons["editorial-article-\(article.slug)"]
        reveal(card, in: app); card.tap()
        reveal(app.staticTexts[source.journal.disclaimer], in: app)
        reveal(app.staticTexts[try XCTUnwrap(article.sections.last).body], in: app)
    }
}
