package com.mediconnect.nativeapp

import android.app.Application
import android.content.Context
import org.json.JSONObject

class MediConnectApplication : Application() {
    val runtime by lazy { runCatching { MobileRuntime(this) } }
    val content by lazy { MobileContent(JSONObject(assets.open("mobile-content.json").bufferedReader().use { it.readText() })) }
    val policies by lazy { MobilePolicies(
        JSONObject(assets.open("legal.json").bufferedReader().use { it.readText() }),
        JSONObject(assets.open("consent.json").bufferedReader().use { it.readText() })) }
}

class MobileRuntime(private val context: Context) : WorkspaceServices {
    private fun read(name: String) = JSONObject(context.assets.open(name).bufferedReader().use { it.readText() })
    val config = MobileConfiguration(read("mobile-config.json"), BuildConfig.RESIDENCY)
    override val contract = MobileContract(read("mobile-contract.json"), read("session-policy.json"))
    override val sessions = CognitoSession(context, config, contract)
    override val profiles = ProfileApi(NativeApi(config, sessions, NativeHttp.client(config)), contract)
    override val appointments = AppointmentsApi(config, contract, sessions, NativeHttp.client(config))
    // This preference is a non-sensitive logout safety latch, never a credential or a profile cache.
    private val preferences = context.getSharedPreferences("session-safety", Context.MODE_PRIVATE)
    override var requiresExplicitSignIn: Boolean
        get() = preferences.getBoolean("requires-explicit-sign-in", false)
        set(value) { preferences.edit().putBoolean("requires-explicit-sign-in", value).apply() }
}
