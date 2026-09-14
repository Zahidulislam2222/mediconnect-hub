package com.mediconnect.nativeapp

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test

class PolicyEntryTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    private fun document(name: String): JSONObject {
        val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
        return JSONObject(assets.open(name).bufferedReader().use { it.readText() })
    }
    @Test fun unconfiguredSignInPoliciesReadCloseAndReturnHome() {
        val journey = NativeJourney(document("journey.json"))
        val policies = MobilePolicies(document("legal.json"), document("consent.json"))
        val content = MobileContent(document("mobile-content.json"))
        compose.onAllNodesWithText(journey.login).onFirst().performClick()
        for ((key, page) in policies.pages) {
            compose.onNode(hasScrollAction()).performScrollToNode(hasTestTag("policy-$key"))
            compose.onNodeWithTag("policy-$key").performClick()
            compose.onNodeWithTag("policy-updated").assertTextContains(policies.updated, substring = true)
            for ((index, section) in page.sections.withIndex()) {
                compose.onNodeWithTag("policy-body").performScrollToNode(hasTestTag("policy-section-$index"))
                compose.onNodeWithTag("policy-section-$index").assertIsDisplayed().assertTextEquals(section.body)
            }
            compose.onNodeWithTag("policy-close").performClick()
            compose.onNodeWithTag("policy-body").assertDoesNotExist()
        }
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(content.text("configurationUnavailable")))
        compose.onNodeWithText(content.text("configurationUnavailable")).assertIsDisplayed()
        compose.onNodeWithText(content.text("signIn")).assertDoesNotExist()
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(journey.home))
        compose.onNodeWithText(journey.home).performClick()
        compose.onNodeWithText(journey.hero.title + "\n" + journey.hero.emphasis).assertIsDisplayed()
    }
}
