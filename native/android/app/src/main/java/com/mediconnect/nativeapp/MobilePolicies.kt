package com.mediconnect.nativeapp

import org.json.JSONObject

data class PolicySection(val title: String, val body: String)
data class PolicySource(val label: String, val url: String)
data class PolicyPage(val title: String, val sections: List<PolicySection>, val sources: List<PolicySource>)

class MobilePolicies(legal: JSONObject, consent: JSONObject) {
    val notice = legal.getString("notice").also { require(it.isNotBlank()) }
    val policyVersion = consent.getString("policyVersion").also { require(it.isNotBlank()) }
    val acceptance = consent.getString("signupDescription").also { require(it.isNotBlank()) }
    val pages = legal.getJSONObject("pages").let { pages ->
        listOf("privacy", "terms", "security").associateWith { key ->
            val page = pages.getJSONObject(key)
            val sections = page.getJSONArray("sections")
            val sources = page.getJSONArray("sources")
            PolicyPage(page.getString("title"), (0 until sections.length()).map {
                sections.getJSONObject(it).let { section -> PolicySection(section.getString("title"), section.getString("body")) }
            }, (0 until sources.length()).map {
                sources.getJSONObject(it).let { source -> PolicySource(source.getString("label"), source.getString("url")) }
            })
        }
    }
}
