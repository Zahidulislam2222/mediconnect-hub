package com.mediconnect.nativeapp

import org.json.JSONObject
import java.net.URI

data class PolicySection(val title: String, val body: String)
data class PolicySource(val label: String, val url: String)
data class PolicyPage(val title: String, val sections: List<PolicySection>, val sources: List<PolicySource>)

class MobilePolicies(legal: JSONObject, consent: JSONObject) {
    val updated = legal.requiredText("updated").also { require(Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}").matches(it)) }
    val notice = legal.requiredText("notice")
    val policyVersion = consent.requiredText("policyVersion")
    val acceptance = consent.requiredText("signupDescription")
    val pages = legal.getJSONObject("pages").let { pages ->
        listOf("privacy", "terms", "security").associateWith { key ->
            val page = pages.getJSONObject(key)
            val sections = page.getJSONArray("sections")
            val sources = page.getJSONArray("sources")
            require(sections.length() > 0)
            PolicyPage(page.requiredText("title"), (0 until sections.length()).map {
                sections.getJSONObject(it).let { section -> PolicySection(section.requiredText("title"), section.requiredText("body")) }
            }, (0 until sources.length()).map {
                sources.getJSONObject(it).let { source ->
                    val url = source.requiredText("url")
                    val uri = URI(url)
                    require(uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank() && uri.rawUserInfo == null)
                    PolicySource(source.requiredText("label"), url)
                }
            })
        }
    }

    private fun JSONObject.requiredText(key: String): String {
        val value = get(key)
        require(value is String && value.isNotBlank())
        return value
    }
}
