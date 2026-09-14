package com.mediconnect.nativeapp

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test

class JourneyLibraryTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    private fun journey() = NativeJourney(JSONObject(InstrumentationRegistry.getInstrumentation().targetContext.assets
        .open("journey.json").bufferedReader().use { it.readText() }))
    private fun scrollTo(text: String) {
        compose.onAllNodes(hasScrollAction()).onFirst().performScrollToNode(hasText(text))
    }
    @Test fun knowledgeSearchArticleAndBackPreserveQuery() {
        val journey = journey(); val content = journey.editorial
        val article = content.filtered(EditorialKind.KNOWLEDGE).first()
        compose.onNodeWithText(content.knowledgeLink).performClick()
        compose.onNodeWithText(content.search).performTextInput(article.title.uppercase())
        compose.onNodeWithText(content.search).performImeAction()
        scrollTo(article.title); compose.onNodeWithText(article.title).performClick()
        scrollTo(article.sections.last().body)
        compose.onNodeWithText(article.sections.last().body).assertIsDisplayed()
        compose.activityRule.scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        scrollTo(content.search)
        compose.onNodeWithText(content.search).assertTextContains(article.title.uppercase())
        compose.activityRule.scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText(journey.brand).assertIsDisplayed()
    }
    @Test fun emptySearchCanClearFilters() {
        val content = journey().editorial
        compose.onNodeWithText(content.knowledgeLink).performClick()
        compose.onNodeWithText(content.search).performTextInput("missing-test-search")
        compose.onNodeWithText(content.search).performImeAction()
        scrollTo(content.empty); compose.onNodeWithText(content.empty).assertIsDisplayed()
        compose.onNodeWithText(content.clear).performClick()
        compose.onNodeWithText(content.empty).assertDoesNotExist()
        scrollTo(content.articles.first { it.kind == EditorialKind.KNOWLEDGE }.title)
        compose.onNodeWithText(content.articles.first { it.kind == EditorialKind.KNOWLEDGE }.title).assertIsDisplayed()
    }
    @Test fun journalShowsItsArticleAndDisclaimer() {
        val content = journey().editorial; val article = content.filtered(EditorialKind.JOURNAL).first()
        compose.onNodeWithText(content.journalLink).performClick()
        compose.onNodeWithText(content.search).assertDoesNotExist()
        scrollTo(article.title); compose.onNodeWithText(article.title).performClick()
        scrollTo(content.journal.disclaimer); compose.onNodeWithText(content.journal.disclaimer).assertIsDisplayed()
        scrollTo(article.sections.last().body); compose.onNodeWithText(article.sections.last().body).assertIsDisplayed()
    }
    @Test fun categoryAndSearchSurviveActivityRecreation() {
        val content = journey().editorial
        val article = content.filtered(EditorialKind.KNOWLEDGE).first()
        compose.onNodeWithText(content.knowledgeLink).performClick()
        compose.onNodeWithText(content.search).performTextInput(article.audience)
        compose.onNodeWithText(content.search).performImeAction()
        compose.onNode(hasText(article.category) and hasClickAction()).performClick()
        compose.activityRule.scenario.recreate()
        compose.onNodeWithText(content.search).assertTextContains(article.audience)
        compose.onNode(hasText(article.category) and hasClickAction()).assertIsSelected()
        val expected = content.filtered(EditorialKind.KNOWLEDGE, article.audience, article.category).size
        scrollTo("$expected ${content.guides}")
        compose.onNodeWithText("$expected ${content.guides}").assertIsDisplayed()
    }
}
