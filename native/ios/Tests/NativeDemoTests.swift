import XCTest
@testable import MediConnectApp

final class NativeDemoTests: XCTestCase {
    private func document() throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "journey", withExtension: "json"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }
    private func demo(_ source: [String: Any]) throws -> NativeDemo {
        let data = try JSONSerialization.data(withJSONObject: source)
        return try NativeDemo(data: data, editorial: NativeEditorial(data: data))
    }
    func testCanonicalContentAndKnowledgeReferencesLoad() throws {
        let source = try document(), content = try demo(source)
        XCTAssertEqual(Set(content.roles.map(\.id)), Set(DemoRole.allCases))
        XCTAssertEqual(content.initialState().slot, (source["sample"] as? [String: Any])?["defaultSlot"] as? String)
        XCTAssertEqual(content.copy.noteMaxLength, (source["workspace"] as? [String: Any])?["noteMaxLength"] as? Int)
    }
    func testMalformedCopyRolesAndSlotsAreRejected() throws {
        for (section, key, value) in [("workspace", "notice", 42 as Any), ("explore", "body", " "),
                                      ("sample", "defaultSlot", "unlisted"), ("sample", "slots", [42]),
                                      ("sample", "slots", [] as [String]), ("sample", "slots", ["same", "same"])] {
            var source = try document(), object = try XCTUnwrap(source[section] as? [String: Any])
            object[key] = value; source[section] = object
            XCTAssertThrowsError(try demo(source))
        }
        for role in ["admin", "staff"] {
            var source = try document(), explore = try XCTUnwrap(source["explore"] as? [String: Any])
            var roles = try XCTUnwrap(explore["roles"] as? [[String: Any]])
            roles[0]["id"] = role; explore["roles"] = roles; source["explore"] = explore
            XCTAssertThrowsError(try demo(source))
        }
    }
    func testWebSchemaRequiresMultipleSlots() throws {
        var single = try document(), sample = try XCTUnwrap(single["sample"] as? [String: Any])
        sample["slots"] = [try XCTUnwrap(sample["defaultSlot"] as? String)]; single["sample"] = sample
        XCTAssertThrowsError(try demo(single))
    }
    func testWebSchemaRejectsExcessiveConfiguredNoteLimit() throws {
        var excessive = try document(), copy = try XCTUnwrap(excessive["workspace"] as? [String: Any])
        copy["noteMaxLength"] = 2001; excessive["workspace"] = copy
        XCTAssertThrowsError(try demo(excessive))
    }
    func testInvalidLimitsAndArticleReferencesAreRejected() throws {
        for value in [0, -1, 1.5, "500", true, Int64.max] as [Any] {
            var source = try document(), copy = try XCTUnwrap(source["workspace"] as? [String: Any])
            copy["noteMaxLength"] = value; source["workspace"] = copy
            XCTAssertThrowsError(try demo(source))
        }
        let source = try document(), data = try JSONSerialization.data(withJSONObject: source)
        let journal = try XCTUnwrap(NativeEditorial(data: data).articles.first { $0.kind == .journal })
        for key in ["preparationArticleSlug", "coordinationArticleSlug"] {
            for slug in ["missing", journal.slug] {
                var changed = source, copy = try XCTUnwrap(source["workspace"] as? [String: Any])
                copy[key] = slug; changed["workspace"] = copy
                XCTAssertThrowsError(try demo(changed))
            }
        }
    }
    func testNoteHandoffScheduleAndReadinessSurviveRoleChanges() throws {
        let content = try demo(document()); var state = content.initialState()
        state.editNote("  Fictional question  ", content: content); state.saveNote()
        state.role = .staff; state.ready = true; try state.selectSlot(content.sample.slots[0], content: content)
        state.role = .doctor
        XCTAssertEqual(state.note, "Fictional question"); XCTAssertTrue(state.ready)
        XCTAssertEqual(state.slot, content.sample.slots[0])
        XCTAssertThrowsError(try state.selectSlot("unlisted", content: content))
        state.editNote("  ", content: content); state.saveNote(); XCTAssertEqual(state.note, "")
    }
    func testConfiguredUtf16LimitNeverSplitsSupplementaryCharacters() throws {
        let content = try demo(document()), cap = content.copy.noteMaxLength
        let prefix = String(repeating: "x", count: cap - 1); var state = content.initialState()
        state.editNote(prefix + "😀", content: content); XCTAssertEqual(state.draft, prefix)
        state.editNote(String(repeating: "😀", count: cap), content: content); XCTAssertEqual(state.draft.utf16.count, cap)
        state.editNote(String(repeating: "e\u{0301}", count: cap), content: content); state.saveNote()
        XCTAssertTrue(state.saved); XCTAssertEqual(state.note.utf16.count, cap)
        state.editNote("new", content: content); XCTAssertFalse(state.saved)
    }
    func testResetAndNewInstancesClearAllTransientChanges() throws {
        let content = try demo(document()); var state = content.initialState(role: .staff)
        state.editNote("fictional", content: content); state.saveNote()
        state.ready = true; state.visit = true; state.mic = true; state.camera = true
        state.reset(content)
        XCTAssertEqual(state.role, .staff); XCTAssertEqual(state.note, content.sample.note)
        XCTAssertEqual(state.draft, content.sample.note); XCTAssertEqual(state.slot, content.sample.defaultSlot)
        XCTAssertFalse(state.ready); XCTAssertFalse(state.saved); XCTAssertFalse(state.visit)
        XCTAssertFalse(state.mic); XCTAssertFalse(state.camera)
        XCTAssertEqual(try demo(document()).initialState().note, content.sample.note)
    }
}
