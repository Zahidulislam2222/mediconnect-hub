import XCTest

final class NativeDemoUITests: XCTestCase {
    override func setUpWithError() throws {
        try super.setUpWithError()
        continueAfterFailure = false
    }
    private struct Fixture: Decodable {
        struct Explore: Decodable {
            struct Role: Decodable { let id: String; let action: String; let label: String }
            let roles: [Role]
        }
        struct Sample: Decodable { let note: String; let slots: [String] }
        struct Copy: Decodable {
            let save: String; let reset: String; let toggle: String; let pending: String; let ready: String
            let consult: String; let close: String; let micOff: String; let micOn: String
            let camOff: String; let camOn: String; let callNotice: String
            let preparationArticleSlug: String; let coordinationArticleSlug: String
        }
        struct Library: Decodable { let read: String; let back: String }
        struct Navigation: Decodable { let home: String }
        struct Article: Decodable { struct Section: Decodable { let body: String }; let slug: String; let sections: [Section] }
        let explore: Explore; let sample: Sample; let workspace: Copy
        let library: Library; let navigation: Navigation; let articles: [Article]
    }
    private func fixture() throws -> Fixture {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "journey", withExtension: "json"))
        return try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
    }
    private func reveal(_ element: XCUIElement, in app: XCUIApplication, down: Bool = false) {
        for _ in 0..<30 {
            if element.isHittable { return }
            if down { app.swipeDown() } else { app.swipeUp() }
        }
        XCTAssertTrue(element.isHittable)
    }
    private func tap(_ title: String, in app: XCUIApplication, down: Bool = false) {
        let button = app.buttons[title]
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
                button.tap(); return
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
        XCTFail("Control is not fully visible: \(title); target=\(frame); viewport=\(viewport); app=\(app.frame)")
    }
    private func replaceNote(_ note: XCUIElement, with text: String, in app: XCUIApplication) {
        reveal(note, in: app); note.tap(); note.press(forDuration: 1)
        let menuItem = app.menuItems["Select All"]
        let menuButton = app.buttons["Select All"]
        if menuItem.waitForExistence(timeout: 5) { menuItem.tap() }
        else if menuButton.waitForExistence(timeout: 5) { menuButton.tap() }
        else { XCTFail("Native Select All action is unavailable"); return }
        note.typeText(text)
        XCTAssertEqual(note.value as? String, text)
    }
    private func role(_ id: String, fixture: Fixture) throws -> Fixture.Explore.Role {
        try XCTUnwrap(fixture.explore.roles.first { $0.id == id })
    }
    private func savedNote(_ app: XCUIApplication) -> XCUIElement { app.staticTexts["demo-saved-note"] }
    private func readGuide(_ slug: String, fixture: Fixture, app: XCUIApplication) throws {
        tap(fixture.library.read, in: app)
        let article = try XCTUnwrap(fixture.articles.first { $0.slug == slug })
        let body = try XCTUnwrap(article.sections.last).body
        let paragraph = app.staticTexts.matching(NSPredicate(format: "label == %@", body)).firstMatch
        reveal(paragraph, in: app)
        let back = app.buttons.matching(identifier: fixture.library.back).element(boundBy: 1)
        reveal(back, in: app); back.tap()
    }
    func testPatientHandoffStaffReadinessAndBothGuideLinks() throws {
        let source = try fixture(), app = XCUIApplication(); app.launch()
        let patient = try role("patient", fixture: source), doctor = try role("doctor", fixture: source), staff = try role("staff", fixture: source)
        tap(patient.action, in: app)
        let note = app.descendants(matching: .any).matching(identifier: "demo-note").firstMatch
        replaceNote(note, with: "  Fictional handoff  ", in: app)
        tap(source.workspace.save, in: app)
        tap(doctor.label, in: app, down: true)
        reveal(savedNote(app), in: app); XCTAssertEqual(savedNote(app).label, "Fictional handoff")
        tap(staff.label, in: app, down: true)
        tap(source.sample.slots[0], in: app); tap(source.workspace.toggle, in: app)
        XCTAssertFalse(savedNote(app).exists); XCTAssertFalse(note.exists)
        try readGuide(source.workspace.coordinationArticleSlug, fixture: source, app: app)
        tap(doctor.label, in: app, down: true)
        let slot = app.staticTexts["demo-selected-slot"]; reveal(slot, in: app); XCTAssertEqual(slot.label, source.sample.slots[0])
        let ready = app.staticTexts["demo-readiness"]; reveal(ready, in: app); XCTAssertEqual(ready.label, source.workspace.ready)
        reveal(savedNote(app), in: app); XCTAssertEqual(savedNote(app).label, "Fictional handoff")
        try readGuide(source.workspace.preparationArticleSlug, fixture: source, app: app)
        tap(source.workspace.reset, in: app, down: true)
        reveal(savedNote(app), in: app); XCTAssertEqual(savedNote(app).label, source.sample.note)
    }
    func testConsultationResetAndRelaunchClearTransientState() throws {
        let source = try fixture(), app = XCUIApplication(); app.launch()
        tap(try role("patient", fixture: source).action, in: app)
        tap(source.workspace.consult, in: app)
        let mic = app.switches[source.workspace.micOff], camera = app.switches[source.workspace.camOff]
        reveal(mic, in: app); mic.tap(); reveal(camera, in: app); camera.tap()
        let notice = app.staticTexts.matching(NSPredicate(format: "label == %@", source.workspace.callNotice)).firstMatch
        reveal(notice, in: app)
        tap(source.workspace.reset, in: app, down: true); tap(source.workspace.consult, in: app)
        reveal(mic, in: app); XCTAssertEqual(mic.value as? String, "0")
        reveal(camera, in: app); XCTAssertEqual(camera.value as? String, "0")
        tap(source.workspace.close, in: app, down: true)
        tap(try role("staff", fixture: source).label, in: app, down: true); tap(source.workspace.toggle, in: app)
        app.terminate(); app.launch()
        tap(try role("doctor", fixture: source).action, in: app)
        let status = app.staticTexts["demo-readiness"]; reveal(status, in: app); XCTAssertEqual(status.label, source.workspace.pending)
        reveal(savedNote(app), in: app); XCTAssertEqual(savedNote(app).label, source.sample.note)
    }
    func testLargeTextKeepsEveryPerspectiveAndGuideReachable() throws {
        let source = try fixture(), app = XCUIApplication()
        app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch(); tap(source.explore.roles[0].action, in: app)
        for role in source.explore.roles {
            tap(role.label, in: app, down: true)
            reveal(app.buttons[source.library.read], in: app)
        }
    }
}
