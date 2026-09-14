import XCTest

final class NativeUITests: XCTestCase {
    func testUnconfiguredAppLaunchesAndBlocksSignIn() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["MediConnect"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Care that stays\nwith you."].exists)
        app.buttons["Log in"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["This app's connection is not available yet."].exists)
        XCTAssertFalse(app.buttons["Sign in"].exists)
        app.buttons["Home"].tap()
        XCTAssertTrue(app.staticTexts["Care that stays\nwith you."].exists)
    }
    func testJourneySupportsLargeTextAndScrollingToQualification() {
        let app = XCUIApplication()
        app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        XCTAssertTrue(app.buttons["Log in"].firstMatch.waitForExistence(timeout: 10))
        let qualification = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "Fictional people")).firstMatch
        for _ in 0..<24 {
            if qualification.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(qualification.isHittable)
        app.swipeUp()
        app.buttons.matching(identifier: "Log in").element(boundBy: 1).tap()
        XCTAssertTrue(app.staticTexts["This app's connection is not available yet."].exists)
    }
}
