import XCTest

final class AuthenticatorSetupUITests: XCTestCase {
    private func launch() -> XCUIApplication {
        let app = XCUIApplication(); app.launchArguments = [NativeUITestProtocol.authenticatorSetup]; app.launch()
        XCTAssertTrue(app.buttons["Reveal setup key"].waitForExistence(timeout: 10))
        return app
    }
    func testRevealRequiresActionAndSubmitHidesKeyAndClearsCode() {
        let app = launch(); XCTAssertFalse(app.staticTexts["test-key"].exists)
        app.buttons["Reveal setup key"].tap(); XCTAssertTrue(app.staticTexts["test-key"].exists)
        let field = app.secureTextFields["Verification code"]; field.tap(); field.typeText("123456")
        app.buttons["Verify"].tap()
        XCTAssertTrue(app.staticTexts[NativeUITestProtocol.authenticatorCodeAccepted].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["test-key"].exists); XCTAssertFalse(app.buttons["Verify"].isEnabled)
    }
    func testAppSwitchRetainsEnrollmentWithHiddenKeyAndEmptyCode() {
        let app = launch(); app.buttons["Reveal setup key"].tap()
        let field = app.secureTextFields["Verification code"]; field.tap(); field.typeText("123456")
        XCUIDevice.shared.press(.home); app.activate()
        XCTAssertTrue(app.buttons["Reveal setup key"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["test-key"].exists); XCTAssertFalse(app.buttons["Verify"].isEnabled)
    }
    func testCancelDropsSetupAndReturnsToSignIn() {
        let app = launch(); app.buttons["Reveal setup key"].tap(); app.buttons["Cancel"].tap()
        XCTAssertTrue(app.staticTexts["Sign in"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["test-key"].exists); XCTAssertFalse(app.buttons["Reveal setup key"].exists)
    }
    func testKeyCanBeHiddenWithoutSubmitting() {
        let app = launch(); app.buttons["Reveal setup key"].tap(); app.buttons["Hide setup key"].tap()
        XCTAssertFalse(app.staticTexts["test-key"].exists)
        XCTAssertFalse(app.staticTexts[NativeUITestProtocol.authenticatorCodeAccepted].exists)
    }
}
