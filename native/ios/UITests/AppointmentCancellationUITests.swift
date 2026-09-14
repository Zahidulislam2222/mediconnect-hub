import XCTest

final class AppointmentCancellationUITests: XCTestCase {
    private func open(lostResponse: Bool = false) -> XCUIApplication {
        let app = XCUIApplication(); app.launchArguments = [NativeUITestProtocol.cancellation]
        if lostResponse { app.launchArguments.append(NativeUITestProtocol.cancellationLostResponse) }
        app.launch(); XCTAssertTrue(app.buttons["Cancel appointment"].waitForExistence(timeout: 10))
        app.buttons["Cancel appointment"].tap(); return app
    }
    func testKeepAppointmentDismissesWithoutConfirmation() {
        let app = open(); app.buttons["Keep appointment"].tap()
        XCTAssertTrue(app.buttons["Cancel appointment"].exists)
        XCTAssertFalse(app.buttons["Confirm cancellation"].exists)
    }
    func testExplicitConfirmationShowsTruthfulReadback() {
        let app = open(); app.buttons["Confirm cancellation"].tap()
        XCTAssertTrue(app.staticTexts["Cancellation was confirmed. This does not verify that a refund has completed."].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Confirm cancellation"].exists)
    }
    func testLostResponseCanResolveUsingStatusCheck() {
        let app = open(lostResponse: true); app.buttons["Confirm cancellation"].tap()
        XCTAssertTrue(app.buttons["Check cancellation status"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Confirm cancellation"].exists); app.buttons["Check cancellation status"].tap()
        XCTAssertTrue(app.staticTexts["Cancellation was confirmed. This does not verify that a refund has completed."].waitForExistence(timeout: 5))
    }
}
