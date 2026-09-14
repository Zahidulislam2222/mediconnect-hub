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

class JourneyAccessibilityTest {
    @get:Rule val compose = createComposeRule()
    @Test fun narrowLargeTextJourneyKeepsActionAndQualificationReachable() {
        val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
        val journey = NativeJourney(JSONObject(assets.open("journey.json").bufferedReader().use { it.readText() }))
        val content = MobileContent(JSONObject(assets.open("mobile-content.json").bufferedReader().use { it.readText() }))
        var opened = false
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(LocalDensity.current.density, 2f)) {
                Box(Modifier.width(320.dp)) { MobileTheme(content) { JourneyWelcome(journey) { opened = true } } }
            }
        }
        compose.onAllNodesWithText(journey.login).onFirst().assertIsDisplayed().performClick()
        assertTrue(opened)
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(journey.notice))
        compose.onNodeWithText(journey.notice).assertIsDisplayed()
        val bounds = compose.onNodeWithText(journey.notice).fetchSemanticsNode().boundsInRoot
        val root = compose.onRoot().fetchSemanticsNode().boundsInRoot
        assertTrue(bounds.left >= root.left && bounds.right <= root.right)
    }
}
