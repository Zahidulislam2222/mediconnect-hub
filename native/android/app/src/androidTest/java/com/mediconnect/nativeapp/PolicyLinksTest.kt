package com.mediconnect.nativeapp

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.UriHandler
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class PolicyLinksTest {
    @get:Rule val compose = createComposeRule()
    private fun document(name: String): JSONObject {
        val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
        return JSONObject(assets.open(name).bufferedReader().use { it.readText() })
    }
    private val policies by lazy { MobilePolicies(document("legal.json"), document("consent.json")) }
    private val content by lazy { MobileContent(document("mobile-content.json")) }
    private val opened = mutableListOf<String>()
    private fun render(fail: Boolean = false, large: Boolean = false) {
        val handler = object : UriHandler {
            override fun openUri(uri: String) {
                opened.add(uri)
                if (fail) throw IllegalArgumentException("test-handler-unavailable")
            }
        }
        compose.setContent {
            CompositionLocalProvider(LocalUriHandler provides handler,
                LocalDensity provides Density(LocalDensity.current.density, if (large) 2f else 1f)) {
                Box(Modifier.width(320.dp)) { MobileTheme(content) { PolicyLinks(policies, content) } }
            }
        }
    }
    private fun reveal(tag: String) {
        compose.onNodeWithTag("policy-body").performScrollToNode(hasTestTag(tag))
        compose.onNodeWithTag(tag).assertIsDisplayed()
    }
    private fun readAll() {
        for ((key, page) in policies.pages) {
            compose.onNodeWithTag("policy-$key").performClick()
            reveal("policy-updated")
            compose.onNodeWithTag("policy-updated").assertTextContains(policies.updated, substring = true)
            for ((index, section) in page.sections.withIndex()) {
                reveal("policy-section-$index")
                compose.onNodeWithTag("policy-section-$index").assertTextEquals(section.body)
            }
            for (index in page.sources.indices) reveal("policy-source-$index")
            compose.onNodeWithTag("policy-close").assertIsDisplayed().performClick()
            compose.onNodeWithTag("policy-body").assertDoesNotExist()
        }
        compose.runOnIdle { assertTrue(opened.isEmpty()) }
    }
    @Test fun allPoliciesReadAndCloseWithoutOpeningSources() { render(); readAll() }
    @Test fun narrowLargeTextKeepsEverySectionAndCloseReachable() { render(large = true); readAll() }
    @Test fun citationUsesPlatformHandlerOnlyAfterTap() {
        render()
        compose.onNodeWithTag("policy-privacy").performClick()
        reveal("policy-source-0")
        compose.runOnIdle { assertTrue(opened.isEmpty()) }
        compose.onNodeWithTag("policy-source-0").performClick()
        compose.runOnIdle { assertEquals(listOf(policies.pages.getValue("privacy").sources.first().url), opened) }
        compose.onNodeWithTag("policy-link-failed").assertDoesNotExist()
        compose.onNodeWithTag("policy-close").performClick()
    }
    @Test fun unavailableHandlerPreservesPolicyAndAllowsRetryAndClose() {
        render(fail = true)
        compose.onNodeWithTag("policy-security").performClick()
        reveal("policy-source-0")
        compose.onNodeWithTag("policy-source-0").performClick()
        compose.onNodeWithTag("policy-link-failed").assertIsDisplayed().assertTextEquals(content.text("policyLinkFailed"))
        reveal("policy-source-0")
        compose.onNodeWithTag("policy-source-0").performClick()
        compose.runOnIdle { assertEquals(2, opened.size) }
        compose.onNodeWithTag("policy-close").performClick()
        compose.onNodeWithTag("policy-terms").performClick()
        compose.onNodeWithTag("policy-link-failed").assertDoesNotExist()
        compose.onNodeWithTag("policy-close").performClick()
    }
}
