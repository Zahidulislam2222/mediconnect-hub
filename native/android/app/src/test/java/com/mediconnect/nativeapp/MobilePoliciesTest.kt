package com.mediconnect.nativeapp

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class MobilePoliciesTest {
    private fun document(name: String) = JSONObject(javaClass.classLoader!!.getResourceAsStream(name)!!.bufferedReader().use { it.readText() })
    private fun policies(legal: JSONObject = document("legal.json"), consent: JSONObject = document("consent.json")) = MobilePolicies(legal, consent)
    @Test fun canonicalPagesAndEmptyTermsCitationsAreAccepted() {
        val source = document("legal.json"); val result = policies(source)
        assertEquals(setOf("privacy", "terms", "security"), result.pages.keys)
        assertTrue(result.pages.values.all { it.sections.isNotEmpty() })
        assertTrue(result.pages.getValue("terms").sources.isEmpty())
        assertEquals(source.getString("notice"), result.notice)
    }
    @Test fun rejectsNumericAndWhitespaceRequiredCopy() {
        for (value in listOf<Any>(42, " ")) {
            val source = document("legal.json"); source.put("notice", value)
            assertThrows(Exception::class.java) { policies(source) }
        }
        val consent = document("consent.json"); consent.put("signupDescription", " ")
        assertThrows(Exception::class.java) { policies(consent = consent) }
    }
    @Test fun rejectsEmptySectionsAndBlankPageCopy() {
        val empty = document("legal.json"); empty.getJSONObject("pages").getJSONObject("privacy").put("sections", JSONArray())
        assertThrows(Exception::class.java) { policies(empty) }
        val blank = document("legal.json"); blank.getJSONObject("pages").getJSONObject("privacy").put("title", " ")
        assertThrows(Exception::class.java) { policies(blank) }
    }
    @Test fun rejectsMalformedSectionBodies() {
        for (value in listOf<Any>(42, " ")) {
            val source = document("legal.json")
            source.getJSONObject("pages").getJSONObject("privacy").getJSONArray("sections").getJSONObject(0).put("body", value)
            assertThrows(Exception::class.java) { policies(source) }
        }
    }
    @Test fun rejectsUnsafeCitationTargets() {
        for (url in listOf("http://example.test", "javascript:alert(1)", "/relative", "https://test-user:test-key@example.test",
            "https:///missing-host", "https://example.test/a b", " ")) {
            val source = document("legal.json")
            source.getJSONObject("pages").getJSONObject("privacy").getJSONArray("sources").getJSONObject(0).put("url", url)
            assertThrows(Exception::class.java) { policies(source) }
        }
    }
    @Test fun requiresCanonicalUpdateDateShape() {
        for (value in listOf<Any>(42, "", "2026/09/11", " 2026-09-11")) {
            val source = document("legal.json"); source.put("updated", value)
            assertThrows(Exception::class.java) { policies(source) }
        }
    }
}
