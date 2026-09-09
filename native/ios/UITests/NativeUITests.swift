import XCTest

final class NativeUITests: XCTestCase {
    func testUnconfiguredAppLaunchesAndBlocksSignIn() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["MediConnect"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["This app's connection is not available yet."].exists)
        XCTAssertFalse(app.buttons["Sign in"].exists)
    }
}
