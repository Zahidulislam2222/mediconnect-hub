import XCTest
@testable import MediConnectApp

final class MobilePoliciesTests: XCTestCase {
    private func document(_ name: String) throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: name, withExtension: "json"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }
    private func policies(_ legal: [String: Any], consent: [String: Any]? = nil) throws -> MobilePolicies {
        try MobilePolicies(legal: JSONSerialization.data(withJSONObject: legal),
                           consent: JSONSerialization.data(withJSONObject: consent ?? document("consent")))
    }
    private func changedPage(_ change: (inout [String: Any]) throws -> Void) throws -> [String: Any] {
        var legal = try document("legal")
        var pages = try XCTUnwrap(legal["pages"] as? [String: Any])
        var page = try XCTUnwrap(pages["privacy"] as? [String: Any])
        try change(&page); pages["privacy"] = page; legal["pages"] = pages
        return legal
    }
    func testCanonicalPagesDateAndEmptyTermsCitations() throws {
        let source = try document("legal"); let result = try policies(source)
        XCTAssertEqual(Set(result.pages.keys), Set(["privacy", "terms", "security"]))
        XCTAssertEqual(result.updated, source["updated"] as? String)
        XCTAssertTrue(result.pages.values.allSatisfy { !$0.sections.isEmpty })
        XCTAssertTrue(try XCTUnwrap(result.pages["terms"]).sources.isEmpty)
    }
    func testRejectsNumericAndWhitespaceRequiredCopy() throws {
        for value: Any in [42, " "] {
            var legal = try document("legal"); legal["notice"] = value
            XCTAssertThrowsError(try policies(legal))
            var consent = try document("consent"); consent["signupDescription"] = value
            XCTAssertThrowsError(try policies(document("legal"), consent: consent))
        }
    }
    func testRejectsEmptySectionsAndBlankPageCopy() throws {
        XCTAssertThrowsError(try policies(changedPage { $0["sections"] = [] }))
        XCTAssertThrowsError(try policies(changedPage { $0["title"] = " " }))
    }
    func testRejectsMalformedSectionBodies() throws {
        for value: Any in [42, " "] {
            let source = try changedPage { page in
                var sections = try XCTUnwrap(page["sections"] as? [[String: Any]])
                sections[0]["body"] = value; page["sections"] = sections
            }
            XCTAssertThrowsError(try policies(source))
        }
    }
    func testRejectsUnsafeCitationTargets() throws {
        for url in ["http://example.test", "javascript:alert(1)", "/relative", "https://test-user:test-key@example.test",
                    "https:///missing-host", "https://example.test/a b", " "] {
            let source = try changedPage { page in
                var sources = try XCTUnwrap(page["sources"] as? [[String: Any]])
                sources[0]["url"] = url; page["sources"] = sources
            }
            XCTAssertThrowsError(try policies(source))
        }
    }
    func testRequiresCanonicalUpdateDateShape() throws {
        for value: Any in [42, "", "2026/09/11", " 2026-09-11", "2026-09-11\n"] {
            var legal = try document("legal"); legal["updated"] = value
            XCTAssertThrowsError(try policies(legal))
        }
    }
}
