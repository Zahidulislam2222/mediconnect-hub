package com.mediconnect.nativeapp

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NativeJourneyTest {
    private fun document() = JSONObject(javaClass.classLoader!!.getResourceAsStream("journey.json")!!.bufferedReader().use { it.readText() })
    @Test fun loadsCanonicalNarrativeAndLocalAssets() {
        val source = document()
        val journey = NativeJourney(source)
        assertEquals(source.getJSONObject("hero").getString("title"), journey.hero.title)
        assertEquals(source.getJSONArray("stages").length(), journey.chapters.size)
        assertEquals(source.getJSONObject("media").getString("poster").substringAfterLast('/'), journey.poster)
        assertTrue(journey.notice.contains("Fictional"))
    }
    @Test fun rejectsRemoteOrTraversingMedia() {
        for (path in listOf("", "https://example.test/poster.webp", "/media/journey/../poster.webp", "/media/journey/a.webp?x=1")) {
            val source = document(); source.getJSONObject("media").put("poster", path)
            assertThrows(IllegalArgumentException::class.java) { NativeJourney(source) }
        }
    }
    @Test fun rejectsMissingOrBlankCopyAndDuplicateChapters() {
        val blank = document(); blank.put("brand", " ")
        assertThrows(IllegalArgumentException::class.java) { NativeJourney(blank) }
        val invalid = document(); invalid.put("notice", 42)
        assertThrows(IllegalArgumentException::class.java) { NativeJourney(invalid) }
        val duplicate = document(); duplicate.getJSONArray("stages").put(duplicate.getJSONArray("stages").get(0))
        assertThrows(IllegalArgumentException::class.java) { NativeJourney(duplicate) }
    }
}
