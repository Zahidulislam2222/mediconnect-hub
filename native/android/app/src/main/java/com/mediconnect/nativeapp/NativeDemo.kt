package com.mediconnect.nativeapp

import org.json.JSONObject

// Public fictional perspectives, deliberately separate from authenticated roles.
enum class DemoRole(val wire: String) { PATIENT("patient"), DOCTOR("doctor"), STAFF("staff") }
data class DemoPerspective(val id: DemoRole, val label: String, val title: String, val body: String, val action: String, val number: String)
data class DemoSample(val patient: String, val patientInitials: String, val doctorInitials: String, val doctor: String, val date: String, val year: String, val timezone: String, val appointment: String, val defaultSlot: String, val note: String, val slots: List<String>)
data class DemoCopy(val coordinationArticleSlug: String, val preparationArticleSlug: String, val eyebrow: String, val greeting: String, val notice: String, val appointment: String, val choose: String, val notes: String, val noteHint: String, val save: String, val saved: String, val ready: String, val pending: String, val toggle: String, val reset: String, val consult: String, val close: String, val callTitle: String, val callNotice: String, val micOn: String, val micOff: String, val camOn: String, val camOff: String, val followup: String, val followupBody: String, val queue: String, val staff: String, val doctor: String, val patient: String, val details: String, val noteMaxLength: Int)

class NativeDemo(document: JSONObject, editorial: NativeEditorial) {
    private fun text(source: JSONObject, key: String): String =
        (source.get(key) as? String)?.also { require(it.isNotBlank()) }
            ?: throw IllegalArgumentException("Invalid demo content")
    val tagline = text(document, "tagline")
    val workspaceLabel = text(document.getJSONObject("labels"), "workspace")
    private val explore = document.getJSONObject("explore")
    val eyebrow = text(explore, "eyebrow")
    val title = text(explore, "title")
    val body = text(explore, "body")
    val roles = explore.getJSONArray("roles").let { values ->
        List(values.length()) { i -> values.getJSONObject(i).let { source ->
            DemoPerspective(DemoRole.entries.single { it.wire == text(source, "id") },
                text(source, "label"), text(source, "title"), text(source, "body"), text(source, "action"), text(source, "number"))
        } }.also { values ->
            require(values.map { it.id }.toSet() == DemoRole.entries.toSet() && values.size == DemoRole.entries.size)
        }
    }
    val sample = document.getJSONObject("sample").let { source ->
        val slots = source.getJSONArray("slots").let { values ->
            List(values.length()) { i -> (values.get(i) as? String)?.also { require(it.isNotBlank()) }
                ?: throw IllegalArgumentException("Invalid sample slot") }
        }
        // Content-schema guards match the approved web schema; runtime values come from JSON.
        require(slots.size >= 2 && slots.distinct().size == slots.size)
        DemoSample(text(source, "patient"), text(source, "patientInitials"), text(source, "doctorInitials"), text(source, "doctor"), text(source, "date"), text(source, "year"), text(source, "timezone"), text(source, "appointment"), text(source, "defaultSlot"), text(source, "note"), slots)
            .also { require(it.defaultSlot in slots) }
    }
    val copy = document.getJSONObject("workspace").let { source ->
        val limit = source.get("noteMaxLength") as? Number ?: throw IllegalArgumentException("Invalid note limit")
        require(limit.toDouble() > 0 && limit.toDouble() <= 2000 && limit.toDouble() == limit.toInt().toDouble())
        DemoCopy(text(source, "coordinationArticleSlug"), text(source, "preparationArticleSlug"), text(source, "eyebrow"), text(source, "greeting"), text(source, "notice"), text(source, "appointment"), text(source, "choose"), text(source, "notes"), text(source, "noteHint"), text(source, "save"), text(source, "saved"), text(source, "ready"), text(source, "pending"), text(source, "toggle"), text(source, "reset"), text(source, "consult"), text(source, "close"), text(source, "callTitle"), text(source, "callNotice"), text(source, "micOn"), text(source, "micOff"), text(source, "camOn"), text(source, "camOff"), text(source, "followup"), text(source, "followupBody"), text(source, "queue"), text(source, "staff"), text(source, "doctor"), text(source, "patient"), text(source, "details"), limit.toInt())
    }
    init {
        require(sample.note.length <= copy.noteMaxLength)
        require(editorial.article(EditorialKind.KNOWLEDGE, copy.preparationArticleSlug) != null)
        require(editorial.article(EditorialKind.KNOWLEDGE, copy.coordinationArticleSlug) != null)
    }
    fun initialState(role: DemoRole = DemoRole.PATIENT) = DemoState(role, sample.defaultSlot, sample.note, sample.note)
}

// Owned by the welcome composition with remember, never saved or serialized.
data class DemoState(val role: DemoRole, val slot: String, val note: String, val draft: String,
    val ready: Boolean = false, val saved: Boolean = false, val visit: Boolean = false,
    val mic: Boolean = false, val camera: Boolean = false) {
    fun selectSlot(value: String, content: NativeDemo): DemoState {
        require(value in content.sample.slots)
        return copy(slot = value)
    }
    fun editNote(value: String, content: NativeDemo): DemoState {
        var end = 0
        while (end < value.length) {
            val width = Character.charCount(value.codePointAt(end))
            if (end + width > content.copy.noteMaxLength) break
            end += width
        }
        return copy(draft = value.substring(0, end), saved = false)
    }
    fun saveNote() = copy(note = draft.trim(), saved = true)
    fun reset(content: NativeDemo) = content.initialState(role)
}
