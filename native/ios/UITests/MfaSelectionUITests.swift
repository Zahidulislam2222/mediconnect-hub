import XCTest

final class MfaSelectionUITests: XCTestCase {
    func testOnlyAllowedChoicesAreShownAndSelectionAdvancesToCode() {
        let app = XCUIApplication(); app.launchArguments = [NativeUITestProtocol.mfaSelection]; app.launch()
        let authenticator = app.buttons["Authenticator app"]
        XCTAssertTrue(authenticator.waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["Text message"].exists)
        XCTAssertTrue(app.buttons["Email code"].exists)
        authenticator.tap()
        XCTAssertTrue(app.secureTextFields["Verification code"].waitForExistence(timeout: 5))
        XCTAssertFalse(authenticator.exists)
    }
    func testBusyStateDisablesChoices() {
        let app = XCUIApplication(); app.launchArguments = [NativeUITestProtocol.mfaSelection, NativeUITestProtocol.mfaBusy]; app.launch()
        XCTAssertTrue(app.buttons["Authenticator app"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["Authenticator app"].isEnabled)
        XCTAssertFalse(app.buttons["Email code"].isEnabled)
    }
    func testCancelRemovesChoices() {
        let app = XCUIApplication(); app.launchArguments = [NativeUITestProtocol.mfaSelection]; app.launch()
        XCTAssertTrue(app.buttons["Cancel"].waitForExistence(timeout: 10)); app.buttons["Cancel"].tap()
        XCTAssertTrue(app.staticTexts["Sign in"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Authenticator app"].exists)
    }
}
