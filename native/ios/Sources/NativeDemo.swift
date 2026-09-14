import Foundation

// Public fictional perspectives, never authentication grants.
enum DemoRole: String, Decodable, CaseIterable { case patient, doctor, staff }
struct DemoPerspective: Decodable, Identifiable {
    let id: DemoRole
    let label: String
    let title: String
    let body: String
    let action: String
    let number: String
    var strings: [String] { [label, title, body, action, number] }
}
struct DemoSample: Decodable {
    let patient: String
    let patientInitials: String
    let doctorInitials: String
    let doctor: String
    let date: String
    let year: String
    let timezone: String
    let appointment: String
    let defaultSlot: String
    let note: String
    let slots: [String]
    var strings: [String] { [patient, patientInitials, doctorInitials, doctor, date, year, timezone, appointment, defaultSlot, note] + slots }
}
struct DemoCopy: Decodable {
    let coordinationArticleSlug: String
    let preparationArticleSlug: String
    let eyebrow: String
    let greeting: String
    let notice: String
    let appointment: String
    let choose: String
    let notes: String
    let noteHint: String
    let save: String
    let saved: String
    let ready: String
    let pending: String
    let toggle: String
    let reset: String
    let consult: String
    let close: String
    let callTitle: String
    let callNotice: String
    let micOn: String
    let micOff: String
    let camOn: String
    let camOff: String
    let followup: String
    let followupBody: String
    let queue: String
    let staff: String
    let doctor: String
    let patient: String
    let details: String
    let noteMaxLength: Int
    var strings: [String] { [coordinationArticleSlug, preparationArticleSlug, eyebrow, greeting, notice, appointment, choose, notes, noteHint, save, saved, ready, pending, toggle, reset, consult, close, callTitle, callNotice, micOn, micOff, camOn, camOff, followup, followupBody, queue, staff, doctor, patient, details] }
}
struct NativeDemo {
    let eyebrow: String; let title: String; let body: String
    let tagline: String; let workspaceLabel: String
    let roles: [DemoPerspective]; let sample: DemoSample; let copy: DemoCopy
    init(data: Data, editorial: NativeEditorial) throws {
        struct Explore: Decodable { let eyebrow: String; let title: String; let body: String; let roles: [DemoPerspective] }
        struct Labels: Decodable { let workspace: String }
        struct Document: Decodable { let tagline: String; let labels: Labels; let explore: Explore; let sample: DemoSample; let workspace: DemoCopy }
        let document = try JSONDecoder().decode(Document.self, from: data)
        let explore = document.explore, sample = document.sample, copy = document.workspace
        let strings = [document.tagline, document.labels.workspace, explore.eyebrow, explore.title, explore.body] + explore.roles.flatMap(\.strings) + sample.strings + copy.strings
        guard strings.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }),
              Set(explore.roles.map(\.id)) == Set(DemoRole.allCases), explore.roles.count == DemoRole.allCases.count,
              sample.slots.count >= 2, Set(sample.slots).count == sample.slots.count, sample.slots.contains(sample.defaultSlot),
              copy.noteMaxLength > 0, copy.noteMaxLength <= 2000, sample.note.utf16.count <= copy.noteMaxLength,
              editorial.article(.knowledge, slug: copy.preparationArticleSlug) != nil,
              editorial.article(.knowledge, slug: copy.coordinationArticleSlug) != nil else { throw MobileFailure.configuration }
        tagline = document.tagline; workspaceLabel = document.labels.workspace
        self.eyebrow = explore.eyebrow; self.title = explore.title; self.body = explore.body
        self.roles = explore.roles; self.sample = sample; self.copy = copy
    }
    func initialState(role: DemoRole = .patient) -> DemoState {
        DemoState(role: role, slot: sample.defaultSlot, note: sample.note, draft: sample.note)
    }
}

// Transient view state: never Codable, persisted, logged or sent to providers.
struct DemoState {
    var role: DemoRole
    private(set) var slot: String; private(set) var note: String; private(set) var draft: String
    var ready = false; private(set) var saved = false; var visit = false; var mic = false; var camera = false
    init(role: DemoRole, slot: String, note: String, draft: String) {
        self.role = role; self.slot = slot; self.note = note; self.draft = draft
    }
    mutating func selectSlot(_ value: String, content: NativeDemo) throws {
        guard content.sample.slots.contains(value) else { throw MobileFailure.configuration }
        slot = value
    }
    mutating func editNote(_ value: String, content: NativeDemo) {
        var units = 0
        var result = String.UnicodeScalarView()
        for scalar in value.unicodeScalars {
            let width = scalar.utf16.count
            guard units + width <= content.copy.noteMaxLength else { break }
            result.append(scalar); units += width
        }
        draft = String(result); saved = false
    }
    mutating func saveNote() { note = draft.trimmingCharacters(in: .whitespacesAndNewlines); saved = true }
    mutating func reset(_ content: NativeDemo) { self = content.initialState(role: role) }
}
