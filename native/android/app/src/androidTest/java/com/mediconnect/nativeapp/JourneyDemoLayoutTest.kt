package com.mediconnect.nativeapp

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test

class JourneyDemoLayoutTest {
    @get:Rule val compose = createComposeRule()
    private fun document(name: String) = JSONObject(InstrumentationRegistry.getInstrumentation().targetContext.assets
        .open(name).bufferedReader().use { it.readText() })
    @Test fun narrowDoubleTextSupportsAllPerspectivesAndSupplementaryInput() {
        val journey = NativeJourney(document("journey.json")); val content = MobileContent(document("mobile-content.json"))
        compose.setContent {
            var state by remember { mutableStateOf(journey.demo.initialState()) }
            CompositionLocalProvider(LocalDensity provides Density(LocalDensity.current.density, 2f)) {
                Box(Modifier.width(320.dp)) { MobileTheme(content) { JourneyDemoWorkspace(journey, state, { state = it }, {}) } }
            }
        }
        fun reveal(matcher: SemanticsMatcher) {
            compose.onNodeWithTag("demo-workspace").performScrollToNode(matcher)
            compose.onNode(matcher).performScrollTo().assertIsDisplayed()
        }
        reveal(hasTestTag("demo-note"))
        val prefix = "x".repeat(journey.demo.copy.noteMaxLength - 1)
        compose.onNodeWithTag("demo-note").performTextReplacement(prefix + "😀")
        compose.onNodeWithTag("demo-note").assertTextContains(prefix)
        val save = hasText(journey.demo.copy.save) and hasClickAction()
        reveal(save); compose.onNode(save).performClick()
        for (role in journey.demo.roles) {
            val button = hasText(role.label) and hasClickAction()
            reveal(button); compose.onNode(button).performClick()
            val read = hasText(journey.editorial.knowledge.read) and hasClickAction()
            reveal(read)
        }
    }
}
