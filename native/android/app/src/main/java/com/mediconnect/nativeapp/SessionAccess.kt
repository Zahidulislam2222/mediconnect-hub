package com.mediconnect.nativeapp

import org.json.JSONObject
import java.time.Instant
import java.util.Base64

data class Identity(val subject: String, val role: Role, val expiresAt: Instant)

/** No data-class token serialization. Tokens stay in the SDK and short-lived request memory. */
class SessionAccess(val identity: Identity, val token: String)

object SessionClaims {
    // These are JWT/Cognito protocol fields, not user-maintained application configuration.
    fun fromSdkToken(token: String, config: MobileConfiguration, contract: MobileContract, now: Instant): SessionAccess {
        val parts = token.split('.')
        require(parts.size == 3)
        val claims = JSONObject(String(Base64.getUrlDecoder().decode(parts[1]), Charsets.UTF_8))
        require(claims.getString("iss") == config.issuer)
        require(claims.getString("aud") == config.clientId && claims.getString("token_use") == "id")
        val subject = claims.getString("sub")
        require(subject.matches(Regex("[A-Za-z0-9.-]{1,64}")))
        val expiresAt = Instant.ofEpochSecond(claims.getLong("exp"))
        require(expiresAt.isAfter(now))
        return SessionAccess(Identity(subject, contract.role(claims), expiresAt), token)
    }
}
