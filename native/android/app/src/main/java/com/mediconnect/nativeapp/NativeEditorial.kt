package com.mediconnect.nativeapp

import org.json.JSONObject

enum class EditorialKind(val wire: String) { KNOWLEDGE("knowledge"), JOURNAL("blog") }
data class EditorialSection(val heading: String, val body: String)
data class EditorialArticle(val slug: String, val kind: EditorialKind, val category: String,
    val audience: String, val title: String, val summary: String, val minutes: Int,
    val sections: List<EditorialSection>)
data class EditorialCopy(val title: String, val body: String, val eyebrow: String,
    val back: String, val read: String, val disclaimer: String)

class NativeEditorial(document: JSONObject) {
    private fun text(source: JSONObject, key: String): String =
        (source.get(key) as? String)?.also { require(it.isNotBlank()) }
            ?: throw IllegalArgumentException("Invalid editorial content")
    private fun copy(source: JSONObject) = EditorialCopy(text(source, "title"), text(source, "body"),
        text(source, "eyebrow"), text(source, "back"), text(source, "read"), text(source, "disclaimer"))
    private val library = document.getJSONObject("library")
    val knowledge = copy(library)
    val journal = copy(document.getJSONObject("journal"))
    val search = text(library, "search")
    val placeholder = text(library, "placeholder")
    val all = text(library, "all")
    val empty = text(library, "empty")
    val clear = text(library, "clear")
    val categoriesLabel = text(document.getJSONObject("labels"), "categories")
    val minutesRead = text(document.getJSONObject("labels"), "minutesRead")
    val guides = text(document.getJSONObject("labels"), "guides")
    val stories = text(document.getJSONObject("labels"), "stories")
    val knowledgeLink = text(document.getJSONObject("navigation"), "knowledge")
    val journalLink = text(document.getJSONObject("navigation"), "blog")
    val notFound = text(document.getJSONObject("footer"), "notFound")
    val articles = document.getJSONArray("articles").let { array ->
        List(array.length()) { index ->
            val item = array.getJSONObject(index)
            val kind = EditorialKind.entries.single { it.wire == text(item, "kind") }
            val minutes = item.get("minutes") as? Number ?: throw IllegalArgumentException("Invalid reading time")
            require(minutes.toDouble() > 0 && minutes.toDouble() <= Int.MAX_VALUE &&
                minutes.toDouble() == minutes.toInt().toDouble())
            val sections = item.getJSONArray("sections").let { values ->
                List(values.length()) { i -> values.getJSONObject(i).let {
                    EditorialSection(text(it, "heading"), text(it, "body"))
                } }.also { require(it.isNotEmpty()) }
            }
            EditorialArticle(text(item, "slug"), kind, text(item, "category"), text(item, "audience"),
                text(item, "title"), text(item, "summary"), minutes.toInt(), sections)
        }.also { values ->
            require(values.map { it.slug }.distinct().size == values.size)
            require(EditorialKind.entries.all { kind -> values.any { it.kind == kind } })
        }
    }
    fun copy(kind: EditorialKind) = if (kind == EditorialKind.KNOWLEDGE) knowledge else journal
    fun categories() = articles.filter { it.kind == EditorialKind.KNOWLEDGE }.map { it.category }.distinct()
    fun article(kind: EditorialKind, slug: String) = articles.find { it.kind == kind && it.slug == slug }
    fun filtered(kind: EditorialKind, query: String = "", category: String? = null) = articles.filter {
        it.kind == kind && (kind == EditorialKind.JOURNAL ||
            ((category == null || it.category == category) &&
                "${it.title} ${it.summary} ${it.category} ${it.audience}".contains(query, ignoreCase = true)))
    }
}
