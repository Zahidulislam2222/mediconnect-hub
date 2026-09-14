import XCTest

final class EmailMfaSetupUITests: XCTestCase {
    func testEmailSubmissionAdvancesToEmptySecureCodeInput() {
        let app = XCUIApplication(); app.launchArguments = [NativeUITestProtocol.emailMfaSetup]; app.launch()
        let email = app.textFields["Email for verification"]
        XCTAssertTrue(email.waitForExistence(timeout: 10)); XCTAssertFalse(app.buttons["Verify"].isEnabled)
        email.tap(); email.typeText(" test-user@example.invalid "); app.buttons["Verify"].tap()
        XCTAssertTrue(app.secureTextFields["Verification code"].waitForExistence(timeout: 5))
        XCTAssertFalse(email.exists); XCTAssertFalse(app.buttons["Verify"].isEnabled)
    }
    func testBusyStateDisablesEmailAndSubmit() {
        let app = XCUIApplication(); app.launchArguments = [NativeUITestProtocol.emailMfaSetup, NativeUITestProtocol.emailMfaBusy]; app.launch()
        XCTAssertTrue(app.textFields["Email for verification"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.textFields["Email for verification"].isEnabled)
        XCTAssertFalse(app.buttons["Verify"].isEnabled)
    }
    func testCancelClearsEmailSetup() {
        let app = XCUIApplication(); app.launchArguments = [NativeUITestProtocol.emailMfaSetup]; app.launch()
        let email = app.textFields["Email for verification"]; XCTAssertTrue(email.waitForExistence(timeout: 10))
        email.tap(); email.typeText("test-user@example.invalid"); app.buttons["Cancel"].tap()
        XCTAssertTrue(app.staticTexts["Sign in"].waitForExistence(timeout: 5)); XCTAssertFalse(email.exists)
    }
}
