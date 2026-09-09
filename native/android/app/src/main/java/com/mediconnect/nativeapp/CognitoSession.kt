package com.mediconnect.nativeapp

import android.content.Context
import com.amplifyframework.auth.cognito.AWSCognitoAuthPlugin
import com.amplifyframework.auth.cognito.AWSCognitoAuthSession
import com.amplifyframework.auth.result.AuthSignInResult
import com.amplifyframework.core.Amplify
import com.amplifyframework.core.AmplifyConfiguration
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONObject
import java.time.Instant
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

interface SessionProvider { suspend fun fetch(): SessionAccess }

class CognitoSession(context: Context, private val config: MobileConfiguration, private val contract: MobileContract) : SessionProvider {
    init {
        val pool = JSONObject().put("PoolId", config.userPoolId).put("AppClientId", config.clientId).put("Region", config.awsRegion)
        val plugin = JSONObject()
            .put("CognitoUserPool", JSONObject().put("Default", pool))
            .put("Auth", JSONObject().put("Default", JSONObject().put("authenticationFlowType", "USER_SRP_AUTH")))
        val configuration = JSONObject().put("auth", JSONObject().put("plugins", JSONObject().put("awsCognitoAuthPlugin", plugin)))
        Amplify.addPlugin(AWSCognitoAuthPlugin())
        Amplify.configure(AmplifyConfiguration.fromJson(configuration), context.applicationContext)
    }

    override suspend fun fetch(): SessionAccess = suspendCancellableCoroutine { continuation ->
        Amplify.Auth.fetchAuthSession({ result ->
            if (continuation.isActive) {
                try {
                    require(result.isSignedIn)
                    val token = (result as AWSCognitoAuthSession).userPoolTokensResult.value?.idToken
                        ?: error("SESSION_UNAVAILABLE")
                    continuation.resume(SessionClaims.fromSdkToken(token, config, contract, Instant.now()))
                } catch (_: Exception) { continuation.resumeWithException(IllegalStateException("SESSION_UNAVAILABLE")) }
            }
        }, { if (continuation.isActive) continuation.resumeWithException(IllegalStateException("SESSION_UNAVAILABLE")) })
    }

    suspend fun signIn(email: String, password: String): AuthSignInResult = suspendCancellableCoroutine { continuation ->
        Amplify.Auth.signIn(email, password,
            { if (continuation.isActive) continuation.resume(it) },
            { if (continuation.isActive) continuation.resumeWithException(IllegalStateException("SIGN_IN_FAILED")) })
    }

    suspend fun confirm(code: String): AuthSignInResult = suspendCancellableCoroutine { continuation ->
        Amplify.Auth.confirmSignIn(code,
            { if (continuation.isActive) continuation.resume(it) },
            { if (continuation.isActive) continuation.resumeWithException(IllegalStateException("SIGN_IN_FAILED")) })
    }

    suspend fun signOut() = suspendCancellableCoroutine { continuation ->
        Amplify.Auth.signOut { if (continuation.isActive) continuation.resume(Unit) }
    }
}
