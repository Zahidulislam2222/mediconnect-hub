import XCTest

final class RegistrationUITests: XCTestCase {
    private func open() -> XCUIApplication {
        let app = XCUIApplication(); app.launchArguments = [NativeUITestProtocol.registration]; app.launch()
        XCTAssertTrue(app.buttons["Create account"].waitForExistence(timeout: 10)); app.buttons["Create account"].tap()
        return app
    }
    private func reveal(_ element: XCUIElement, in app: XCUIApplication) {
        for _ in 0..<6 { if element.isHittable { return }; app.swipeUp() }
        XCTAssertTrue(element.isHittable)
    }
    func testCreateResendConfirmAndExplicitReturn() {
        let app = open()
        app.textFields["Full name"].tap(); app.textFields["Full name"].typeText("Test person")
        app.textFields["Email"].tap(); app.textFields["Email"].typeText("test-user@example.test")
        app.secureTextFields["Password"].tap(); app.secureTextFields["Password"].typeText("test-password")
        let consent = app.switches.firstMatch; reveal(consent, in: app)
        XCTAssertEqual(consent.value as? String, "0"); XCTAssertFalse(app.buttons["Register"].isEnabled)
        consent.tap(); reveal(app.buttons["Register"], in: app); app.buttons["Register"].tap()
        XCTAssertTrue(app.buttons["Request another code"].waitForExistence(timeout: 5))
        app.buttons["Request another code"].tap()
        app.textFields["Verification code"].tap(); app.textFields["Verification code"].typeText("123456")
        app.buttons["Verify"].tap()
        XCTAssertTrue(app.staticTexts["Account confirmation completed. Sign in to continue."].waitForExistence(timeout: 5))
        app.buttons["Back to sign in"].tap(); XCTAssertTrue(app.buttons["Create account"].exists)
    }
    func testPoliciesAndCancelDoNotAcceptConsent() {
        let app = open()
        let terms = app.buttons["Demonstration terms"]; reveal(terms, in: app); terms.tap()
        XCTAssertTrue(app.staticTexts["Purpose"].waitForExistence(timeout: 5)); app.buttons["Close"].tap()
        let consent = app.switches.firstMatch; reveal(consent, in: app); XCTAssertEqual(consent.value as? String, "0")
        consent.tap(); reveal(app.buttons["Back to sign in"], in: app); app.buttons["Back to sign in"].tap()
        app.buttons["Create account"].tap(); reveal(app.switches.firstMatch, in: app)
        XCTAssertEqual(app.switches.firstMatch.value as? String, "0"); XCTAssertFalse(app.buttons["Register"].isEnabled)
    }
}
