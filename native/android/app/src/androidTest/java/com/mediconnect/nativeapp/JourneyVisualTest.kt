package com.mediconnect.nativeapp

import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test
import java.io.File

/** Captures only the public production composable in an isolated test activity. */
class JourneyVisualTest {
    @get:Rule val compose = createComposeRule()
    @Test fun publicWelcomeRendersWithApprovedContent() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        fun read(name: String) = JSONObject(context.assets.open(name).bufferedReader().use { it.readText() })
        val journey = NativeJourney(read("journey.json"))
        val content = MobileContent(read("mobile-content.json"))
        compose.setContent { MobileTheme(content) { JourneyWelcome(journey) {} } }
        compose.onNodeWithText(journey.hero.title + "\n" + journey.hero.emphasis).assertIsDisplayed()
        val name = InstrumentationRegistry.getArguments().getString("journeyScreenshot") ?: return
        require(Regex("^[a-z0-9-]+\\.png$").matches(name))
        File(context.cacheDir, name).outputStream().use {
            check(compose.onRoot().captureToImage().asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, it))
        }
    }
}
