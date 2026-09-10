package com.mediconnect.nativeapp

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NativeDemoTest {
    private fun document() = JSONObject(javaClass.classLoader!!.getResourceAsStream("journey.json")!!.bufferedReader().use { it.readText() })
    private fun demo(source: JSONObject = document()) = NativeDemo(source, NativeEditorial(source))
    @Test fun canonicalContentAndKnowledgeReferencesLoad() {
        val source = document(); val content = demo(source)
        assertEquals(DemoRole.entries.toSet(), content.roles.map { it.id }.toSet())
        assertEquals(source.getJSONObject("sample").getString("defaultSlot"), content.initialState().slot)
        assertEquals(source.getJSONObject("workspace").getInt("noteMaxLength"), content.copy.noteMaxLength)
    }
    @Test fun malformedCopyRolesAndSlotsAreRejected() {
        val changes: List<(JSONObject) -> Unit> = listOf(
            { it.getJSONObject("workspace").put("notice", 42) },
            { it.getJSONObject("explore").put("body", " ") },
            { it.getJSONObject("explore").getJSONArray("roles").getJSONObject(0).put("id", "admin") },
            { it.getJSONObject("explore").getJSONArray("roles").getJSONObject(0).put("id", "staff") },
            { it.getJSONObject("sample").put("defaultSlot", "unlisted") },
            { it.getJSONObject("sample").getJSONArray("slots").put(0, 42) },
            { it.getJSONObject("sample").put("slots", org.json.JSONArray()) },
            { val s = it.getJSONObject("sample").getJSONArray("slots"); s.put(s.get(0)) }
        )
        changes.forEach { change -> val source = document(); change(source); assertThrows(Exception::class.java) { demo(source) } }
    }
    @Test fun webSchemaRequiresMultipleSlots() {
        val single = document(); val sample = single.getJSONObject("sample")
        sample.put("slots", org.json.JSONArray().put(sample.getString("defaultSlot")))
        assertThrows(Exception::class.java) { demo(single) }
    }
    @Test fun webSchemaRejectsExcessiveConfiguredNoteLimit() {
        val excessive = document(); excessive.getJSONObject("workspace").put("noteMaxLength", 2001)
        assertThrows(Exception::class.java) { demo(excessive) }
    }
    @Test fun invalidLimitsAndArticleReferencesAreRejected() {
        for (limit in listOf<Any>(0, -1, 1.5, "500", true, Long.MAX_VALUE)) {
            val source = document(); source.getJSONObject("workspace").put("noteMaxLength", limit)
            assertThrows(Exception::class.java) { demo(source) }
        }
        for (field in listOf("preparationArticleSlug", "coordinationArticleSlug")) {
            for (slug in listOf("missing", NativeEditorial(document()).articles.first { it.kind == EditorialKind.JOURNAL }.slug)) {
                val source = document(); source.getJSONObject("workspace").put(field, slug)
                assertThrows(Exception::class.java) { demo(source) }
            }
        }
    }
    @Test fun noteHandoffScheduleAndReadinessSurviveRoleChanges() {
        val content = demo()
        var state = content.initialState().editNote("  Fictional question  ", content).saveNote()
        state = state.copy(role = DemoRole.STAFF, ready = true).selectSlot(content.sample.slots.first(), content)
        state = state.copy(role = DemoRole.DOCTOR)
        assertEquals("Fictional question", state.note); assertTrue(state.ready)
        assertEquals(content.sample.slots.first(), state.slot)
        assertThrows(IllegalArgumentException::class.java) { state.selectSlot("unlisted", content) }
        assertEquals("", state.editNote("  ", content).saveNote().note)
    }
    @Test fun configuredUtf16LimitNeverSplitsSupplementaryCharacters() {
        val content = demo(); val cap = content.copy.noteMaxLength
        val prefix = "x".repeat(cap - 1)
        assertEquals(prefix, content.initialState().editNote(prefix + "😀", content).draft)
        assertEquals(cap, content.initialState().editNote("😀".repeat(cap), content).draft.length)
        val state = content.initialState().editNote("e\u0301".repeat(cap), content).saveNote()
        assertTrue(state.saved); assertEquals(cap, state.note.length)
        assertFalse(state.editNote("new", content).saved)
    }
    @Test fun resetAndNewInstancesClearAllTransientChanges() {
        val content = demo()
        val dirty = content.initialState(DemoRole.STAFF).editNote("fictional", content).saveNote()
            .copy(ready = true, visit = true, mic = true, camera = true)
        assertEquals(content.initialState(DemoRole.STAFF), dirty.reset(content))
        assertEquals(content.sample.note, demo().initialState().note)
        assertEquals(DemoRole.STAFF, dirty.reset(content).role)
    }
}
