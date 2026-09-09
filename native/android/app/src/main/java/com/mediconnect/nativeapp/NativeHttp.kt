package com.mediconnect.nativeapp

import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

object NativeHttp {
    fun client(config: MobileConfiguration): OkHttpClient = OkHttpClient.Builder()
        .callTimeout(config.requestTimeoutSeconds, TimeUnit.SECONDS)
        .connectTimeout(config.requestTimeoutSeconds, TimeUnit.SECONDS)
        .readTimeout(config.requestTimeoutSeconds, TimeUnit.SECONDS)
        .cache(null).followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false).build()
}
