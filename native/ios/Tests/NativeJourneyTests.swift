import XCTest
@testable import MediConnectApp

final class NativeJourneyTests: XCTestCase {
    private func document() throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "journey", withExtension: "json"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }
    private func journey(_ document: [String: Any]) throws -> NativeJourney {
        try NativeJourney(data: JSONSerialization.data(withJSONObject: document))
    }
    func testCanonicalContentAndBothPostersDecode() throws {
        let source = try document()
        let content = try journey(source)
        XCTAssertEqual(content.hero.title, (source["hero"] as? [String: String])?["title"])
        XCTAssertEqual(content.chapters.count, (source["stages"] as? [[String: Any]])?.count)
        XCTAssertTrue(content.notice.contains("Fictional"))
        for name in [content.poster, content.homePoster] {
            let image = try XCTUnwrap(JourneyPoster.image(name))
            XCTAssertGreaterThan(image.size.width, 0); XCTAssertGreaterThan(image.size.height, 0)
        }
    }
    func testRemoteAndTraversingMediaAreRejected() throws {
        for value in ["", "https://example.test/poster.webp", "/media/journey/../poster.webp", "/media/journey/a.webp?x=1"] {
            var source = try document()
            var media = try XCTUnwrap(source["media"] as? [String: Any]); media["poster"] = value; source["media"] = media
            XCTAssertThrowsError(try journey(source))
        }
    }
    func testInvalidCopyAndDuplicateChaptersAreRejected() throws {
        var blank = try document(); blank["brand"] = " "
        XCTAssertThrowsError(try journey(blank))
        var invalid = try document(); invalid["notice"] = 42
        XCTAssertThrowsError(try journey(invalid))
        var duplicate = try document()
        var stages = try XCTUnwrap(duplicate["stages"] as? [[String: Any]])
        stages.append(try XCTUnwrap(stages.first)); duplicate["stages"] = stages
        XCTAssertThrowsError(try journey(duplicate))
    }
}
