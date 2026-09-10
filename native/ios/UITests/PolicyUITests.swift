import XCTest

final class PolicyUITests: XCTestCase {
    private func document(_ name: String) throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: name, withExtension: "json"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }
    private func open(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication(); app.launchArguments = [NativeUITestProtocol.registration] + extra; app.launch()
        XCTAssertTrue(app.buttons["Create account"].waitForExistence(timeout: 10)); app.buttons["Create account"].tap()
        return app
    }
    private func reveal(_ element: XCUIElement, in container: XCUIElement) {
        for _ in 0..<12 { if element.isHittable { return }; container.swipeUp() }
        XCTAssertTrue(element.isHittable)
    }
    private func readAll(_ app: XCUIApplication, expectConsent: Bool = true) throws {
        let legal = try document("legal"); let pages = try XCTUnwrap(legal["pages"] as? [String: [String: Any]])
        for key in ["privacy", "security", "terms"] {
            let link = app.buttons["policy-\(key)"]; reveal(link, in: app); link.tap()
            let updated = app.staticTexts["policy-updated"]
            XCTAssertTrue(updated.waitForExistence(timeout: 5))
            XCTAssertTrue(updated.label.contains(try XCTUnwrap(legal["updated"] as? String)))
            let sections = try XCTUnwrap(pages[key]?["sections"] as? [[String: Any]])
            for (index, section) in sections.enumerated() {
                let body = app.staticTexts["policy-section-\(index)"]
                reveal(body, in: app.scrollViews["policy-body"])
                XCTAssertEqual(body.label, section["body"] as? String)
            }
            let close = app.buttons["policy-close"]; XCTAssertTrue(close.isHittable); close.tap()
            XCTAssertFalse(app.staticTexts[NativeUITestProtocol.policyOpenedURL].exists)
        }
        if expectConsent {
            let consent = app.switches.firstMatch; reveal(consent, in: app)
            XCTAssertEqual(consent.value as? String, "0"); XCTAssertFalse(app.buttons["Register"].isEnabled)
        }
    }
    func testAllPoliciesReadCloseAndPreserveUnacceptedConsent() throws { try readAll(open()) }
    func testLargeTextPoliciesRemainReadableAndClosable() throws {
        try readAll(open(["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]))
    }
    func testUnconfiguredSignInPoliciesReturnToHome() throws {
        let app = XCUIApplication(); app.launch()
        XCTAssertTrue(app.buttons["Log in"].firstMatch.waitForExistence(timeout: 10))
        app.buttons["Log in"].firstMatch.tap()
        try readAll(app, expectConsent: false)
        let content = try document("mobile-content")
        let unavailable = app.staticTexts[try XCTUnwrap(content["configurationUnavailable"] as? String)]
        reveal(unavailable, in: app)
        XCTAssertFalse(app.buttons[try XCTUnwrap(content["signIn"] as? String)].exists)
        app.buttons["Home"].tap()
        XCTAssertTrue(app.buttons["Log in"].firstMatch.exists)
    }
    func testCitationPassesCanonicalURLToNativeHandler() throws {
        let app = open([NativeUITestProtocol.policyURLHandled])
        let link = app.buttons["policy-privacy"]; reveal(link, in: app); link.tap()
        let source = app.buttons["policy-source-0"]; reveal(source, in: app.scrollViews["policy-body"]); source.tap()
        XCTAssertFalse(app.staticTexts["policy-link-failed"].exists); app.buttons["policy-close"].tap()
        let legal = try document("legal"); let pages = try XCTUnwrap(legal["pages"] as? [String: [String: Any]])
        let sources = try XCTUnwrap(pages["privacy"]?["sources"] as? [[String: String]])
        let opened = app.staticTexts[NativeUITestProtocol.policyOpenedURL]; reveal(opened, in: app)
        XCTAssertEqual(opened.label, sources.first?["url"])
    }
    func testUnavailableHandlerPreservesReadingAndClose() {
        let app = open([NativeUITestProtocol.policyURLUnavailable])
        let link = app.buttons["policy-security"]; reveal(link, in: app); link.tap()
        let source = app.buttons["policy-source-0"]; reveal(source, in: app.scrollViews["policy-body"]); source.tap()
        XCTAssertTrue(app.staticTexts["policy-link-failed"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["policy-close"].isHittable); app.buttons["policy-close"].tap()
        let terms = app.buttons["policy-terms"]; reveal(terms, in: app); terms.tap()
        XCTAssertFalse(app.staticTexts["policy-link-failed"].exists); app.buttons["policy-close"].tap()
    }
}
