package com.mediconnect.nativeapp

import android.graphics.BitmapFactory
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class JourneyWelcomeTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    private val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    private fun journey() = NativeJourney(JSONObject(assets.open("journey.json").bufferedReader().use { it.readText() }))
    @Test fun approvedEntryOpensRealUnconfiguredAuthAndReturnsHome() {
        val journey = journey()
        compose.onNodeWithText(journey.hero.title + "\n" + journey.hero.emphasis).assertIsDisplayed()
        compose.onAllNodesWithText(journey.login).onFirst().performClick()
        val content = MobileContent(JSONObject(assets.open("mobile-content.json").bufferedReader().use { it.readText() }))
        compose.onNodeWithText(content.text("configurationUnavailable")).assertIsDisplayed()
        compose.onNodeWithText(content.text("signIn")).assertDoesNotExist()
        compose.onNodeWithText(journey.home).performClick()
        compose.onNodeWithText(journey.hero.title + "\n" + journey.hero.emphasis).assertIsDisplayed()
    }
    @Test fun narrativeScrollReachesFictionalQualificationAndPostersDecode() {
        val journey = journey()
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(journey.notice))
        compose.onNodeWithText(journey.notice).assertIsDisplayed()
        for (asset in listOf(journey.poster, journey.homePoster)) assets.open(asset).use {
            val image = requireNotNull(BitmapFactory.decodeStream(it))
            assertTrue(image.width > 0 && image.height > 0)
            image.recycle()
        }
    }
}
