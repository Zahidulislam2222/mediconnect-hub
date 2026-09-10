package com.mediconnect.nativeapp

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class JourneyEditorialAccessibilityTest {
    @get:Rule val compose = createComposeRule()
    @Test fun narrowLargeTextGuideKeepsSearchBodyAndBackReachable() {
        val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
        val journey = NativeJourney(JSONObject(assets.open("journey.json").bufferedReader().use { it.readText() }))
        val content = MobileContent(JSONObject(assets.open("mobile-content.json").bufferedReader().use { it.readText() }))
        val editorial = journey.editorial; val article = editorial.filtered(EditorialKind.KNOWLEDGE).first()
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(LocalDensity.current.density, 2f)) {
                Box(Modifier.width(320.dp)) { MobileTheme(content) { JourneyWelcome(journey) {} } }
            }
        }
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(editorial.knowledgeLink))
        compose.onNodeWithText(editorial.knowledgeLink).performClick()
        fun reveal(text: String) = compose.onAllNodes(hasScrollAction()).onFirst().performScrollToNode(hasText(text))
        reveal(editorial.search)
        compose.onNodeWithText(editorial.search).performTextInput(article.title)
        compose.onNodeWithText(editorial.search).performImeAction()
        val articleCard = hasText(article.title) and hasClickAction() and !hasSetTextAction()
        compose.onAllNodes(hasScrollAction()).onFirst().performScrollToNode(articleCard)
        compose.onNode(articleCard).performClick()
        compose.onAllNodesWithText(editorial.knowledge.back).onFirst().assertExists()
        for (section in article.sections) {
            reveal(section.body)
            val node = compose.onNodeWithText(section.body).assertIsDisplayed().fetchSemanticsNode().boundsInRoot
            val root = compose.onRoot().fetchSemanticsNode().boundsInRoot
            assertTrue(node.left >= root.left && node.right <= root.right)
        }
        reveal(editorial.knowledge.back)
        compose.onAllNodesWithText(editorial.knowledge.back).onFirst().performClick()
        reveal(editorial.search)
        compose.onNodeWithText(editorial.search).assertTextContains(article.title)
    }
}
