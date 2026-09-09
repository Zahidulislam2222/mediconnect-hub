plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

val generatedAssets = layout.buildDirectory.dir("generated/mobileAssets")
val prepareMobileAssets by tasks.registering(Sync::class) {
    from("../../shared") { include("*.json") }
    from("../../../src/content/session-policy.json")
    val localConfig = file("../../local/mobile-config.json")
    if (localConfig.exists()) {
        from(localConfig) { rename { "mobile-config.json" } }
    } else {
        from("../../shared/mobile-config.example.json") { rename { "mobile-config.json" } }
    }
    into(generatedAssets)
}

android {
    namespace = "com.mediconnect.nativeapp"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.mediconnect.nativeapp"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    flavorDimensions += "residency"
    productFlavors {
        create("us") { dimension = "residency"; buildConfigField("String", "RESIDENCY", "\"US\"") }
        create("eu") {
            dimension = "residency"
            applicationIdSuffix = ".eu"
            buildConfigField("String", "RESIDENCY", "\"EU\"")
        }
    }
    buildTypes {
        debug { applicationIdSuffix = ".debug" }
        release { isMinifyEnabled = true; proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt")) }
    }
    buildFeatures { compose = true; buildConfig = true }
    sourceSets["main"].assets.srcDir(generatedAssets)
    sourceSets["test"].resources.srcDir(prepareMobileAssets)
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }
    testOptions { unitTests.isReturnDefaultValues = false }
    // Dependency-update advisories remain visible; compatibility-pinned versions are deliberate.
    lint { abortOnError = true; checkDependencies = false }
}
kotlin { jvmToolchain(17) }
tasks.named("preBuild").configure { dependsOn(prepareMobileAssets) }

dependencies {
    constraints {
        // Align Cognito's older transitive navigation modules with the current AndroidX runtime.
        implementation(libs.navigation.fragment)
        implementation(libs.navigation.ui)
    }
    coreLibraryDesugaring(libs.desugar)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.material3)
    implementation(libs.activity.compose)
    implementation(libs.lifecycle.viewmodel)
    implementation(libs.lifecycle.runtime)
    implementation(libs.amplify.auth)
    implementation(libs.coroutines.android)
    implementation(libs.okhttp)
    debugImplementation(libs.compose.ui.tooling)
    debugImplementation(libs.compose.test.manifest)
    testImplementation(libs.junit)
    testImplementation(libs.json)
    testImplementation(libs.mockwebserver)
    testImplementation(libs.okhttp.tls)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test)
    androidTestImplementation(libs.android.test)
    androidTestImplementation(libs.test.runner)
    androidTestImplementation(libs.espresso.core)
}
