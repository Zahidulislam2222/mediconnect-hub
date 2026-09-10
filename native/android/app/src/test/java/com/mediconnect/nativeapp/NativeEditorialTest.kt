package com.mediconnect.nativeapp

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NativeEditorialTest {
    private fun document() = JSONObject(javaClass.classLoader!!.getResourceAsStream("journey.json")!!.bufferedReader().use { it.readText() })
    @Test fun canonicalArticlesAreCompleteAndKindScoped() {
        val source = document(); val editorial = NativeEditorial(source)
        assertEquals(source.getJSONArray("articles").length(), editorial.articles.size)
        for (kind in EditorialKind.entries) {
            assertTrue(editorial.filtered(kind).isNotEmpty())
            assertTrue(editorial.filtered(kind).all { it.kind == kind && it.sections.isNotEmpty() })
        }
        val article = editorial.articles.first()
        assertEquals(article, editorial.article(article.kind, article.slug))
        assertNull(editorial.article(EditorialKind.entries.first { it != article.kind }, article.slug))
        assertNull(editorial.article(article.kind, "missing-test-article"))
    }
    @Test fun searchCombinesCategoryAndAllFourSearchFields() {
        val editorial = NativeEditorial(document())
        val article = editorial.filtered(EditorialKind.KNOWLEDGE).first()
        for (query in listOf(article.title, article.summary, article.category, article.audience)) {
            assertTrue(editorial.filtered(EditorialKind.KNOWLEDGE, query.uppercase(), article.category).contains(article))
        }
        assertTrue(editorial.filtered(EditorialKind.KNOWLEDGE, article.title, "missing-test-category").isEmpty())
        assertTrue(editorial.filtered(EditorialKind.KNOWLEDGE, "missing-test-search").isEmpty())
        assertEquals(editorial.filtered(EditorialKind.JOURNAL), editorial.filtered(EditorialKind.JOURNAL, "ignored-test-query", "ignored-test-category"))
    }
    @Test fun rejectsDuplicateSlugsAndUnknownKinds() {
        val duplicate = document(); val articles = duplicate.getJSONArray("articles"); articles.put(articles.get(0))
        assertThrows(IllegalArgumentException::class.java) { NativeEditorial(duplicate) }
        val invalid = document(); invalid.getJSONArray("articles").getJSONObject(0).put("kind", "unknown")
        assertThrows(NoSuchElementException::class.java) { NativeEditorial(invalid) }
    }
    @Test fun rejectsMalformedTimesAndMissingSections() {
        for (minutes in listOf(0, -1, 1.5, "3", true, JSONObject.NULL)) {
            val source = document(); source.getJSONArray("articles").getJSONObject(0).put("minutes", minutes)
            assertThrows(IllegalArgumentException::class.java) { NativeEditorial(source) }
        }
        val source = document(); source.getJSONArray("articles").getJSONObject(0).put("sections", JSONArray())
        assertThrows(IllegalArgumentException::class.java) { NativeEditorial(source) }
    }
    @Test fun rejectsBlankArticleSectionAndInterfaceCopy() {
        for (key in listOf("slug", "category", "audience", "title", "summary")) {
            val source = document(); source.getJSONArray("articles").getJSONObject(0).put(key, " ")
            assertThrows(IllegalArgumentException::class.java) { NativeEditorial(source) }
        }
        val source = document(); source.getJSONArray("articles").getJSONObject(0).getJSONArray("sections").getJSONObject(0).put("body", " ")
        assertThrows(IllegalArgumentException::class.java) { NativeEditorial(source) }
        val copy = document(); copy.getJSONObject("library").put("disclaimer", " ")
        assertThrows(IllegalArgumentException::class.java) { NativeEditorial(copy) }
    }
    @Test fun bothPublicDestinationsRequireContent() {
        val source = document(); val articles = source.getJSONArray("articles")
        val knowledge = JSONArray()
        for (index in 0 until articles.length()) {
            val article = articles.getJSONObject(index)
            if (article.getString("kind") == "knowledge") knowledge.put(article)
        }
        source.put("articles", knowledge)
        assertThrows(IllegalArgumentException::class.java) { NativeEditorial(source) }
    }
}
