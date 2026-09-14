import XCTest

final class PasswordChallengeUITests: XCTestCase {
    func testNewPasswordIsSecureExactAndClearedAfterSubmit() {
        let app = XCUIApplication(); app.launchArguments = [NativeUITestProtocol.passwordChallenge]; app.launch()
        let field = app.secureTextFields["New password"]; XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap(); field.typeText(" test-password "); app.buttons["Verify"].tap()
        XCTAssertTrue(app.staticTexts[NativeUITestProtocol.challengeAccepted].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Verify"].isEnabled)
    }
    func testExistingPasswordIsSecureAndCancelClearsIt() {
        let app = XCUIApplication(); app.launchArguments = [NativeUITestProtocol.passwordChallenge, NativeUITestProtocol.existingPassword]; app.launch()
        let field = app.secureTextFields["Password"]; XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap(); field.typeText("test-password"); app.buttons["Cancel"].tap()
        XCTAssertFalse(app.buttons["Verify"].isEnabled)
        XCTAssertFalse(app.staticTexts[NativeUITestProtocol.challengeAccepted].exists)
    }
}
