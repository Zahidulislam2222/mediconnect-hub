import XCTest

final class PatientSettingsUITests: XCTestCase {
    override func setUpWithError() throws {
        try super.setUpWithError()
        continueAfterFailure = false
    }
    private struct Copy: Decodable {
        let fullName: String
        let email: String
        let settings: [String: String]
        let settingsStatus: [String: String]
        func text(_ key: String) throws -> String { try XCTUnwrap(settings[key]) }
        func status(_ key: String) throws -> String { try XCTUnwrap(settingsStatus[key]) }
    }
    private func copy() throws -> Copy {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "mobile-content", withExtension: "json"))
        return try JSONDecoder().decode(Copy.self, from: Data(contentsOf: url))
    }
    private func open(_ source: Copy, large: Bool = false, lostReadback: Bool = false) throws -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [NativeUITestProtocol.patientSettings]
        if lostReadback { app.launchArguments.append(NativeUITestProtocol.patientSettingsLostReadback) }
        if large { app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"] }
        app.launch()
        let entry = app.buttons[try source.text("open")]
        XCTAssertTrue(entry.waitForExistence(timeout: 10)); entry.tap()
        XCTAssertTrue(app.textFields[source.fullName].waitForExistence(timeout: 5))
        return app
    }
    private func reveal(_ button: XCUIElement, in app: XCUIApplication, down: Bool = false) {
        var viewport = CGRect.zero
        for _ in 0..<30 {
            let exists = button.exists
            let frame = exists ? button.frame : .zero
            let navigation = app.navigationBars.firstMatch
            let top = navigation.exists ? navigation.frame.maxY : app.frame.minY
            let keyboard = app.keyboards.firstMatch
            let bottom = keyboard.exists ? keyboard.frame.minY : app.frame.maxY
            viewport = CGRect(x: app.frame.minX, y: top, width: app.frame.width, height: bottom - top)
            guard viewport.height > 0 else {
                XCTFail("No usable viewport: \(viewport)"); return
            }
            if exists, button.isHittable, frame.minY >= top, frame.maxY <= bottom,
               frame.minX >= app.frame.minX, frame.maxX <= app.frame.maxX {
                return
            }
            if exists, !frame.isEmpty {
                if frame.maxY < top - viewport.height { app.swipeDown() }
                else if frame.minY > bottom + viewport.height { app.swipeUp() }
                else {
                    let distance = max(-viewport.height / 3,
                                       min(viewport.height / 3, frame.midY - viewport.midY))
                    let origin = app.coordinate(withNormalizedOffset: .zero)
                    let start = origin.withOffset(CGVector(dx: app.frame.width / 2,
                                                          dy: viewport.midY - app.frame.minY))
                    let end = start.withOffset(CGVector(dx: 0, dy: -distance))
                    start.press(forDuration: 0.05, thenDragTo: end,
                                withVelocity: .slow, thenHoldForDuration: 0.05)
                }
            }
            else if down { app.swipeDown() }
            else { app.swipeUp() }
        }
        let frame = button.exists ? button.frame : .zero
        XCTFail("Control is not fully visible: \(button.identifier); target=\(frame); viewport=\(viewport); app=\(app.frame)")
    }

    private func tap(_ title: String, in app: XCUIApplication, down: Bool = false) {
        let button = app.buttons[title]; reveal(button, in: app, down: down); button.tap()
    }
    private func field(_ title: String, in app: XCUIApplication) -> XCUIElement {
        let single = app.textFields[title]
        return single.exists ? single : app.textViews[title]
    }
    func testLargestTextWithKeyboardSavesSettingsAndPreservesReadOnlyEmail() throws {
        let source = try copy(); let app = try open(source, large: true)
        XCTAssertFalse(app.textFields[source.email].exists)
        let phone = field(try source.text("phone"), in: app)
        reveal(phone, in: app); phone.tap(); phone.typeText("5550100")
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        let address = field(try source.text("address"), in: app)
        reveal(address, in: app); address.tap(); address.typeText("Test address")
        let preference = app.buttons[NativeUITestProtocol.settingsPreferencePrefix + "sms"]
        reveal(preference, in: app); preference.tap()
        app.buttons[try source.text("enabled")].tap()
        tap(try source.text("save"), in: app)
        let saved = app.staticTexts[try source.status("SAVED")]
        reveal(saved, in: app, down: true); XCTAssertTrue(saved.exists)
        reveal(phone, in: app); XCTAssertEqual(phone.value as? String, "5550100")
        reveal(address, in: app); XCTAssertEqual(address.value as? String, "Test address")
        XCTAssertTrue(app.staticTexts["test@example.invalid"].exists)
        tap(try source.text("close"), in: app)
        XCTAssertTrue(app.buttons[try source.text("open")].waitForExistence(timeout: 5))
    }
    func testUncertainSaveRequiresReloadAndCloseDiscardsUnsavedDraft() throws {
        let source = try copy(); let app = try open(source, lostReadback: true)
        let phone = field(try source.text("phone"), in: app)
        reveal(phone, in: app); phone.tap(); phone.typeText("5550100")
        tap(try source.text("save"), in: app)
        let uncertain = app.staticTexts[try source.status("SAVE_UNCERTAIN")]
        reveal(uncertain, in: app, down: true); XCTAssertTrue(uncertain.exists)
        XCTAssertFalse(app.buttons[try source.text("save")].isEnabled)
        XCTAssertFalse(app.buttons[try source.text("discard")].isEnabled)
        tap(try source.text("reload"), in: app)
        reveal(phone, in: app, down: true); XCTAssertEqual(phone.value as? String, "5550100")
        phone.tap(); phone.typeText("99")
        tap(try source.text("close"), in: app)
        let entry = app.buttons[try source.text("open")]
        XCTAssertTrue(entry.waitForExistence(timeout: 5)); entry.tap()
        reveal(phone, in: app); XCTAssertEqual(phone.value as? String, "5550100")
    }
}
