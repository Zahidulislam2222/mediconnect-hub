package com.mediconnect.nativeapp

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test

class JourneyDemoTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    private val journey by lazy { NativeJourney(JSONObject(InstrumentationRegistry.getInstrumentation().targetContext.assets
        .open("journey.json").bufferedReader().use { it.readText() })) }
    private val demo get() = journey.demo
    private fun reveal(matcher: SemanticsMatcher) {
        compose.onAllNodes(hasScrollAction()).onFirst().performScrollToNode(matcher)
        compose.onNode(matcher).performScrollTo()
    }
    private fun tap(text: String) {
        val matcher = hasText(text) and hasClickAction()
        reveal(matcher); compose.onNode(matcher).performClick()
    }
    private fun open(role: DemoRole) = tap(demo.roles.single { it.id == role }.action)
    private fun role(role: DemoRole) = tap(demo.roles.single { it.id == role }.label)
    private fun back() = compose.activityRule.scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
    @Test fun patientNoteClinicianHandoffStaffReadinessAndGuideBack() {
        open(DemoRole.PATIENT)
        reveal(hasTestTag("demo-note")); compose.onNodeWithTag("demo-note").performTextReplacement("  Fictional handoff  ")
        tap(demo.copy.save)
        role(DemoRole.DOCTOR)
        reveal(hasTestTag("demo-saved-note")); compose.onNodeWithTag("demo-saved-note").assertTextEquals("Fictional handoff")
        role(DemoRole.STAFF)
        tap(demo.sample.slots.first()); tap(demo.copy.toggle)
        compose.onNodeWithTag("demo-note").assertDoesNotExist()
        compose.onNodeWithTag("demo-saved-note").assertDoesNotExist()
        tap(journey.editorial.knowledge.read)
        val article = journey.editorial.article(EditorialKind.KNOWLEDGE, demo.copy.coordinationArticleSlug)!!
        reveal(hasText(article.sections.last().body)); compose.onNodeWithText(article.sections.last().body).assertIsDisplayed()
        back(); role(DemoRole.DOCTOR)
        reveal(hasTestTag("demo-selected-slot")); compose.onNodeWithTag("demo-selected-slot").assertTextEquals(demo.sample.slots.first())
        reveal(hasText(demo.copy.ready)); compose.onNodeWithText(demo.copy.ready).assertIsDisplayed()
        reveal(hasTestTag("demo-saved-note")); compose.onNodeWithTag("demo-saved-note").assertTextEquals("Fictional handoff")
        tap(journey.editorial.knowledge.read)
        val guide = journey.editorial.article(EditorialKind.KNOWLEDGE, demo.copy.preparationArticleSlug)!!
        reveal(hasText(guide.sections.last().body)); back()
        tap(demo.copy.reset)
        reveal(hasTestTag("demo-saved-note")); compose.onNodeWithTag("demo-saved-note").assertTextEquals(demo.sample.note)
    }
    @Test fun consultationControlsAreLocalAndResetClearsThem() {
        open(DemoRole.PATIENT); tap(demo.copy.consult)
        tap(demo.copy.micOff); tap(demo.copy.camOff)
        reveal(hasText(demo.copy.callNotice)); compose.onNodeWithText(demo.copy.callNotice).assertIsDisplayed()
        tap(demo.copy.reset); tap(demo.copy.consult)
        reveal(hasText(demo.copy.micOff)); compose.onNodeWithText(demo.copy.micOff).assertIsNotSelected()
        reveal(hasText(demo.copy.camOff)); compose.onNodeWithText(demo.copy.camOff).assertIsNotSelected()
        back(); reveal(hasText(demo.copy.consult)); compose.onNodeWithText(demo.copy.consult).assertIsDisplayed()
        back(); compose.onNodeWithText(journey.brand).assertIsDisplayed()
    }
    @Test fun recreationClearsNoteAndReadinessWhileHomeNavigationKeepsSession() {
        open(DemoRole.PATIENT)
        reveal(hasTestTag("demo-note")); compose.onNodeWithTag("demo-note").performTextReplacement("Fictional transient note")
        tap(demo.copy.save); role(DemoRole.STAFF); tap(demo.copy.toggle)
        tap(journey.home); open(DemoRole.DOCTOR)
        reveal(hasTestTag("demo-saved-note")); compose.onNodeWithTag("demo-saved-note").assertTextEquals("Fictional transient note")
        compose.activityRule.scenario.recreate()
        open(DemoRole.DOCTOR)
        reveal(hasTestTag("demo-saved-note")); compose.onNodeWithTag("demo-saved-note").assertTextEquals(demo.sample.note)
        reveal(hasText(demo.copy.pending)); compose.onNodeWithText(demo.copy.pending).assertIsDisplayed()
    }
}
