import XCTest

final class PasswordRecoveryUITests: XCTestCase {
    func testRecoveryFormCompletesWithSyntheticProviderOnly() {
        let app = XCUIApplication()
        app.launchArguments = [NativeUITestProtocol.passwordRecovery]
        app.launch()
        let open = app.buttons["Forgot password?"]
        XCTAssertTrue(open.waitForExistence(timeout: 10)); open.tap()
        XCTAssertFalse(app.buttons["Continue"].isEnabled)
        app.textFields["Email"].tap(); app.textFields["Email"].typeText("test-user@example.test")
        app.buttons["Continue"].tap()
        XCTAssertTrue(app.secureTextFields["New password"].waitForExistence(timeout: 5))
        app.textFields["Verification code"].tap(); app.textFields["Verification code"].typeText("123456")
        app.secureTextFields["New password"].tap(); app.secureTextFields["New password"].typeText("test-password")
        app.buttons["Reset password"].tap()
        XCTAssertTrue(app.staticTexts["Password reset completed. Sign in with your new password."].waitForExistence(timeout: 5))
        app.buttons["Back to sign in"].tap()
        XCTAssertTrue(open.waitForExistence(timeout: 5))
    }

    func testCancelReopenClearsCredentials() {
        let app = XCUIApplication()
        app.launchArguments = [NativeUITestProtocol.passwordRecovery]
        app.launch()
        let open = app.buttons["Forgot password?"]
        XCTAssertTrue(open.waitForExistence(timeout: 10)); open.tap()
        app.textFields["Email"].tap(); app.textFields["Email"].typeText("test-user@example.test")
        app.buttons["Continue"].tap()
        XCTAssertTrue(app.secureTextFields["New password"].waitForExistence(timeout: 5))
        app.secureTextFields["New password"].tap(); app.secureTextFields["New password"].typeText("test-password")
        app.buttons["Back to sign in"].tap()
        XCTAssertTrue(open.waitForExistence(timeout: 5)); open.tap()
        XCTAssertFalse(app.buttons["Continue"].isEnabled)
        XCTAssertFalse(app.secureTextFields["New password"].exists)
    }
}
