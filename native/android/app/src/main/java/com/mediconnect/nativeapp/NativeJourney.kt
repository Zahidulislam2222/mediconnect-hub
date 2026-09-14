package com.mediconnect.nativeapp

import org.json.JSONObject

data class JourneyChapter(val id: String, val label: String, val title: String, val emphasis: String, val body: String)

class NativeJourney(document: JSONObject) {
    val editorial = NativeEditorial(document)
    val demo = NativeDemo(document, editorial)
    private fun text(objectValue: JSONObject, key: String): String = (objectValue.get(key) as? String)
        ?.also { require(it.isNotBlank()) } ?: throw IllegalArgumentException("Invalid journey content")
    val brand = text(document, "brand")
    val notice = text(document, "notice")
    val hero = document.getJSONObject("hero").let {
        JourneyChapter("hero", text(it, "eyebrow"), text(it, "title"), text(it, "emphasis"), text(it, "body"))
    }
    val login = text(document.getJSONObject("navigation"), "login")
    val home = text(document.getJSONObject("navigation"), "home")
    val illustration = text(document.getJSONObject("hero"), "illustration")
    val imageDescription = text(document.getJSONObject("media"), "alt")
    val poster = asset(text(document.getJSONObject("media"), "poster"))
    val homePoster = asset(text(document.getJSONObject("media"), "homePoster"))
    val chapters = document.getJSONArray("stages").let { stages ->
        List(stages.length()) { index -> stages.getJSONObject(index).let {
            JourneyChapter(text(it, "id"), text(it, "label"), text(it, "title"), text(it, "emphasis"), text(it, "body"))
        } }.also { require(it.isNotEmpty() && it.map { chapter -> chapter.id }.distinct().size == it.size) }
    }
    private fun asset(path: String): String {
        require(Regex("^/media/journey/[A-Za-z0-9_-]+\\.webp$").matches(path))
        return path.substringAfterLast('/')
    }
}
