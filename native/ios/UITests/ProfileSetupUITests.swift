import XCTest

final class ProfileSetupUITests: XCTestCase {
    private func open(failure: Bool = false) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [NativeUITestProtocol.profile] + (failure ? [NativeUITestProtocol.profileFailure] : [])
        app.launch(); XCTAssertTrue(app.textFields["Full name"].waitForExistence(timeout: 10)); return app
    }
    private func reveal(_ element: XCUIElement, in app: XCUIApplication) {
        for _ in 0..<6 { if element.isHittable { return }; app.swipeUp() }
        XCTAssertTrue(element.isHittable)
    }
    private func submit(_ app: XCUIApplication) {
        app.textFields["Full name"].tap(); app.textFields["Full name"].typeText("Test person")
        app.textFields["Email"].tap(); app.textFields["Email"].typeText("test-user@example.test")
        let consent = app.switches.firstMatch; reveal(consent, in: app)
        XCTAssertEqual(consent.value as? String, "0"); XCTAssertFalse(app.buttons["Save profile"].isEnabled)
        consent.tap(); reveal(app.buttons["Save profile"], in: app); app.buttons["Save profile"].tap()
    }
    func testExplicitConsentSetupAndReadback() {
        let app = open(); submit(app); XCTAssertTrue(app.staticTexts["Appointments"].waitForExistence(timeout: 5))
    }
    func testUncertainSaveRequiresStatusCheckAndFreshConsent() {
        let app = open(failure: true); submit(app)
        let check = app.buttons["Check profile status"]; XCTAssertTrue(check.waitForExistence(timeout: 5)); check.tap()
        let consent = app.switches.firstMatch; reveal(consent, in: app)
        XCTAssertEqual(consent.value as? String, "0"); XCTAssertFalse(app.buttons["Save profile"].isEnabled)
    }
}
