package com.mediconnect.nativeapp

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MobilePolicyPlatformTest {
    private fun document(name: String): JSONObject {
        val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
        return JSONObject(assets.open(name).bufferedReader().use { it.readText() })
    }

    @Test fun numericRequiredCopyIsRejectedOnAndroid() {
        val legal = document("legal.json").put("notice", 42)
        assertThrows(Exception::class.java) { MobilePolicies(legal, document("consent.json")) }
    }
}
